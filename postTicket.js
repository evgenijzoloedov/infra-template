const axios = require('axios').default;
const {Octokit} = require('@octokit/rest');
const semverGt = require('semver/functions/gt');

const commits = [];

const owner = "evgenijzoloedov";
const repo = "infra-template";

const octokit = new Octokit({auth: `${process.env.GITHUB_TOKEN}`});

octokit.repos
    .listTags({
        owner,
        repo,
    })
    .then(({data: tags}) => {

        const renamedTags = tags.map(tag => {
            const name = 'v' + tag.name.slice(3)
            return {...tag, name}
        });

        const sortedTaggedVersions = renamedTags.sort((a, b) => semverGt(a.name, b.name));
        const head = 'rc-' + sortedTaggedVersions[0].name.slice(1);
        const base = 'rc-' + sortedTaggedVersions[1].name.slice(1);

        return octokit.repos.compareCommits({
            owner,
            repo,
            base,
            head,
        });
    })
    .then(({data}) => {
        for (const commit of data.commits) {
            commits.push({
                sha: commit.sha,
                author: commit.author.login,
                message: commit.commit.message
            })
        }
        axios.patch(
            'https://api.tracker.yandex.net/v2/issues/INFRA-23',
            {
                "summary": `Релиз №${process.env.VERSION.slice(13)} от ${new Date().getDate()}/${new Date().getMonth() + 1}/${new Date().getUTCFullYear()}`,
                "description": `<b>Ответственный за релиз: ${process.env.GITHUB_ACTOR}</b>
    Коммиты, попавшие в релиз:
    ${commits.map(commit => `${commit.sha} ${commit.author} ${commit.message}`).join('\n')}`
            }, {
                headers: {
                    "Authorization": `OAuth ${process.env.OAUTH_TOKEN}`,
                    "X-Org-ID": `${process.env.ORG_ID}`
                }
            }).catch(error => console.error(error));
        axios.post(
            'https://api.tracker.yandex.net/v2/issues/INFRA-23/comments',
            {
                "text": `Собрали образ в тегом ${process.env.VERSION}`
            },
            {
                headers: {
                    "Authorization": `OAuth ${process.env.OAUTH_TOKEN}`,
                    "X-Org-ID": `${process.env.ORG_ID}`
                }
            }
        ).catch(error => console.error(error));
    })
    .catch(err => {
        console.error(err);
    });
