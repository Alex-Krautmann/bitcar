'use strict';
const _ = require('lodash');
const axios = require('axios');
const Promise = require('bluebird');

module.exports =  {
    getConfiguredRepos,
    getOwnRepos,
    getReposFromUsernames
};

function getConfiguredRepos(config) {
    const githubConfig = _.find(config.drivers, { type: 'github' });
    let resultPromises = [];
    if (githubConfig && githubConfig.accessToken) {
        resultPromises.push(getOwnRepos(githubConfig));
    }
    if (githubConfig && githubConfig.usernames) {
        resultPromises = resultPromises.concat(getReposFromUsernames(githubConfig));
    }
    if (!resultPromises.length) {
        return Promise.resolve([]);
    }
    return Promise.all(resultPromises);
}

function parseLinkHeader(header) {
    if (header.length === 0) throw new Error("input must not be of zero length");
    const parts = header.split(',');
    const links = _.reduce(parts, (acc, part) => {
        const section = part.split(';');
        if (section.length !== 2) throw new Error("section could not be split on ';'");
        const url = section[0].replace(/<(.*)>/, '$1').trim();
        const name = section[1].replace(/rel="(.*)"/, '$1').trim();
        acc[name] = url;
        return acc;
    }, {});
    return links;
}

function getOwnRepos(config) {
    let reqUrl = `https://api.github.com/user/repos?access_token=${config.accessToken}&page=1`;
    function getPage(sources, url) {
        return axios.get(url).then((res) => {
            const all = sources.concat(_.map(res.data, (item) => {
                const result = {};
                result.name = item.full_name;
                result.clone = item.clone_url;
                result.html = item.html_url;
                return result;
            }));
            if (res.headers.link) {
                let linkHeader = parseLinkHeader(res.headers.link);
                if (linkHeader.next) {
                    return getPage(all, linkHeader.next);
                }
            }
            return all;
        }).catch();
    }
    return getPage([], reqUrl);
}

function getReposFromUsernames(config) {
    return Promise.map(config.usernames, (username) => {
        let reqUrl = `https://api.github.com/users/${username}/repos`;
        return axios.get(reqUrl).then((res) => {
            const sources = _.map(res.data, (item) => {
                const result = {};
                result.name = item.full_name;
                result.clone = item.clone_url;
                result.html = item.html_url;
                return result;
            });
            return sources;
        });
    }).reduce((sources, result) => {
        sources = sources.concat(result);
        return sources;
    }, []);
}
