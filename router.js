'use strict';
const _ = require('lodash');
const inquirer = require('inquirer');
const path = require('path');
const Promise = require('bluebird');
const workspaceDir = require('./lib/workspaceDir');
const output = require('./lib/output');
const getSearchTerm = require('./lib/getSearchTerm');
const mapToHandler = require('./lib/mapToHandler');
const syncExisting = require('./lib/syncExisting');
const getSourceData = require('./lib/getSourceData');
const getSourceResult = require('./lib/getSourceResult');
const getPaths = require('./lib/getPaths');
const maybeClone = require('./lib/maybeClone');
const maybePull = require('./lib/maybePull');
const forceLatest = require('./lib/forceLatest');
const openInBrowser = require('./lib/openInBrowser');

module.exports = router;

function router(options) {
    let searchTerm = getSearchTerm(options);

    if (options.version) {
        output.log(require('./package.json').version);
        return Promise.resolve();
    }

    if (options.setup) {
        return require('./setup')();
    }

    if (options['sync-existing']) {
        return syncExisting();
    }

    if (options.refresh) {
        return getSourceData(true);
    } else {
        const sourceDataPromise = getSourceData();
        const pathsPromise = sourceDataPromise.then(getPaths).filter((v) => (new RegExp(searchTerm)).test(v));
        if (options.completions) {
            return pathsPromise.map((result) => _.tail(result.split(path.sep)).join(path.sep))
                .each(_.ary(output.log, 1));
        } else {
            return pathsPromise.then((results) => {
                let resultPromise;
                if (results.length && options['clone-all']) {
                    return mapToHandler({
                        results,
                        confirmMessage: 'Are you sure you want clone all of the above?',
                        errorMessage: 'Clone all aborted',
                        handler: maybeClone
                    });
                } else if (results.length && options['pull-all']) {
                    return mapToHandler({
                        results,
                        confirmMessage: 'Are you sure you want pull all of the above?',
                        errorMessage: 'Pull all aborted',
                        handler: (r) => maybeClone(r).then(maybePull)
                    });
                } else if (results.length && options['force-latest']) {
                    return mapToHandler({
                        results,
                        confirmMessage: 'Are you sure you want clean and force a hard reset to all of the above?',
                        errorMessage: 'Force latest aborted',
                        handler: forceLatest
                    });
                } else if (results.length > 1) {
                    resultPromise = inquirer.prompt([
                        {
                            type: 'list',
                            name: 'result',
                            message: 'search results',
                            choices: results
                        }
                    ]).then((answers) => getSourceResult(answers.result));
                } else if (results.length) {
                    resultPromise = getSourceResult(results[0]);
                } else {
                    throw new Error('No results.');
                }
                if (options.open) {
                    resultPromise = resultPromise.then(openInBrowser).then(maybeClone);
                } else {
                    resultPromise = resultPromise.then(maybeClone);
                }
                return resultPromise;
            });
        }
    }
}
