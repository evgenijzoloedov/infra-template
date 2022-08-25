const axios = require('axios').default;
const {Octokit} = require('@octokit/rest');
const semverGt = require('semver/functions/gt');


//configs

const owner = "evgenijzoloedov";
const repo = "infra-template";

const octokit = new Octokit({auth: `${process.env.GITHUB_TOKEN}`});

const headersConfig = {
    Authorization: `OAuth ${process.env.OAUTH_TOKEN}`,
    "X-Org-ID": process.env.ORG_ID
}

const api = axios.create({
    baseURL: "https://api.tracker.yandex.net/v2/issues/INFRA-76"
    headers: headersConfig
})

//configs
async function transformTagsToCommits(tags) {
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
}

(async () => {
    const tags = await octokit.repos.listTags({owner, repo}).then(res => res.data)
    const resCommits = await transformTagsToCommits(tags).then(res => res.data.commits)
    const commits = resCommits.map(commit => ({
        sha: commit.sha,
        author: commit.author.login,
        message: commit.commit.message
    }))

    await api.patch("/",
        {
            "summary": `Релиз №${process.env.VERSION.slice(13)} от ${new Date().getDate()}/${new Date().getMonth() + 1}/${new Date().getUTCFullYear()}`,
            "description": `<strong>Ответственный за релиз: ${process.env.GITHUB_ACTOR}</strong>
    Коммиты, попавшие в релиз:
    ${commits.map(commit => `${commit.sha} ${commit.author} ${commit.message}`).join('\n')}`
        }).catch(error => console.error(error));

    await api.post("/comments", {
        "text": `Собрали образ в тегом ${process.env.VERSION}`
    },).catch(error => console.error(error));

})()
