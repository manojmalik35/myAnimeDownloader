let puppeteer = require("puppeteer");
let fs = require("fs");
var axios = require("axios");
var ProgressBar = require("progress");
var Multiprogress = require("multi-progress")(ProgressBar);
const https = require("https");
var path = require("path");

const multi = new Multiprogress(process.stderr);

let browser;
module.exports.start = async function () {
    try {
        let anime = arguments[0], se = arguments[1], ee = arguments[2], downloadPath = arguments[3], credentialsFile = arguments[4], mode = arguments[5];

        let data = await fs.promises.readFile(credentialsFile, "utf-8");
        let credentials = JSON.parse(data);
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            executablePath: credentials.executablePath,
            args: ["--start-maximized",
                // "--disable-extensions-except='.config/google-chrome/Default/Extensions/cfhdojbkjhnklbpkdaibdccddilifddb/3.8.4_0/'",
                // "--load-extension='.config/google-chrome/Default/Extensions/cfhdojbkjhnklbpkdaibdccddilifddb/'"
            ],
            slowMo: 100
        })

        let tabs = await browser.pages();
        let tab = tabs[0];


        await loginHelper(tab, credentials);

        await tab.waitForSelector("#keyword");
        await tab.type("#keyword", anime, { delay: 50 });
        await tab.waitForSelector("#result_box a", { visible: true });
        let suggestions = await tab.$$("#result_box a");
        if (suggestions.length > 3)
            await navigationHelper(tab, null, suggestions[1]);
        else
            await navigationHelper(tab, null, suggestions[0]);

        await tab.waitForSelector("tbody a");
        let episodeLinks = await tab.$$("tbody a");
        let l = episodeLinks.length;
        let episodesToDownload = ee - se + 1;

        let href, compareString;
        if (se < 10)
            compareString = `Episode 00${se}`;
        else if (se < 1000)
            compareString = `Episode 0${se}`;
        else
            compareString = `Episode ${se}`;
        for (let i = l - 1; i >= 0; i--) {
            let text = await (await episodeLinks[i].getProperty('textContent')).jsonValue();

            if (text.includes(compareString)) {
                href = await tab.evaluate(function (anchor) {
                    return anchor.getAttribute("href");
                }, episodeLinks[i]);
                break;
            }
        }

        let chref = "https://kissanime.ru" + href;

        downloadPath = path.join(downloadPath, anime);
        if (!fs.existsSync(downloadPath))
            fs.mkdirSync(downloadPath);

        if (mode == "serial")
            await downloadEpisodeSerial(tab, chref, episodesToDownload, downloadPath);
        else
            await downloadEpisodeParallel(tab, chref, episodesToDownload, downloadPath);

        await browser.close();

    } catch (err) {
        console.log(err.message);
    }

}


async function loginHelper(tab, credentials) {
    try {
        let username = credentials.username;
        let pwd = credentials.pwd;
        let url = "https://kissanime.ru";

        await tab.goto(url, { waitUntil: "networkidle0" });
        await tab.waitForSelector("#topHolderBox a");
        let loginlinks = await tab.$$("#topHolderBox a");

        await Promise.all([
            navigationHelper(tab, null, loginlinks[0]),
            new Promise((resolve) => {
                tab.once('popup', resolve);
                setTimeout(resolve, 5000);
            })
        ]);
        await handleAds();

        await tab.waitForSelector("#username");
        // let ftime = Date.now() + 3000;
        // while (Date.now() < ftime) { }
        await tab.type("#username", username, { delay: 50 });
        await tab.type("#password", pwd, { delay: 50 });
        await Promise.all([
            navigationHelper(tab, "#btnSubmit"),
            new Promise((resolve) => {
                tab.once('popup', resolve);
                setTimeout(resolve, 5000);
            })
        ]);
        await handleAds();
        console.log("User logged in");


    } catch (err) {
        console.log(err.message);
    }
}

async function navigationHelper(tab, selector, element) {
    if (selector != null) {
        await Promise.all([tab.waitForNavigation({
            waitUntil: "networkidle2"
        }),
        tab.click(selector)]);
    } else {
        await Promise.all([tab.waitForNavigation({
            waitUntil: "networkidle2"
        }),
        element.click()]);
    }
}

// function handleAds(browser) {
//     browser.on('targetcreated', async function () {
//         try {
//             console.log('New Tab Created');
//             let pages = await browser.pages();
//             // for (let i = 1; i < pages.length; i++) {
//             //     await pages[i].close();
//             // }
//             pages[1].close();
//         } catch (err) {
//             console.log(err.message);
//         }

//     });
// }

async function handleAds() {
    try {
        console.log('New Tab Created');
        let pages = await browser.pages();
        // for (let i = 1; i < pages.length; i++) {
        //     await pages[i].close();
        // }
        await pages[1].close();
    } catch (err) {
        console.log(err.message);
    }
}

async function handleAds2(tab) {
    try {
        await tab.waitForSelector(".divCloseBut a");
        let ad = await tab.$(".divCloseBut a");
        await ad.click();
        await tab.waitForSelector(".divCloseBut a");
        ad = await tab.$(".divCloseBut a");
        await ad.click();
    } catch (err) {
        console.log(err.message);
    }
}

async function handleAds3(tab) {
    await tab.waitForSelector("iframe");
    var ads = await tab.$$("iframe");

    while (ads != null) {
        for (var i = 0; i < ads.length; i++) {
            await tab.evaluate(function (ad) {
                ad.setAttribute('style', "display:none;");
            }, ads[i]);
        }
        ads = await tab.$$("iframe");
    }
}

async function hrefFinder(tab) {
    let dLink = await tab.$("#divDownload a");

    let href;
    if (dLink == null) {
        let curl = tab.url();
        let carr = curl.split("=");
        carr.pop();
        carr = carr.join("=");
        carr += "=mp4upload";
        await tab.goto(carr, { waitUntil: "networkidle0" });
        await handleAds2(tab);
        await tab.waitForSelector("iframe#my_video_1");
        let frame = await tab.$("iframe#my_video_1");
        let nurl = await tab.evaluate(function (iframe) {
            return iframe.getAttribute("src");
        }, frame);


        let ntab = await browser.newPage();
        await ntab.goto(nurl, { waitUntil: "networkidle2" });
        await ntab.waitForSelector("#download", { timeout: 40000 });
        let ndlink = await ntab.$("#download");

        href = await ntab.evaluate(function (anchor) {
            return anchor.getAttribute("href");
        }, ndlink);
        await ntab.close();
    } else {
        href = await tab.evaluate(function (anchor) {
            return anchor.getAttribute("href");
        }, dLink);
    }

    return href;
}

async function downloadEpisodeSerial(tab, link, totalDownload, downloadPath) {
    try {

        await tab.goto(link, { waitUntil: "networkidle0" });
        let linkArr = [];
        let firstPromise = undefined;
        for (let j = 0; j < totalDownload; j++) {
            await tab.waitForSelector("#navsubbar");
            await handleAds2(tab);

            await scrollToBottom(tab);
            await tab.waitFor(3000);

            let curl = tab.url();
            let episode = curl.split("/").pop();
            let episodeNo = episode.split("?")[0];

            // await tab.waitForSelector("#divDownload a");
            let href = await hrefFinder(tab);
            let agent;
            if (href.includes("mp4"))
                agent = new https.Agent({ rejectUnauthorized: false });
            else
                agent = new https.Agent({ keepAlive: true });

            if (j != totalDownload - 1) {
                await tab.waitForSelector("#btnNext");
                await navigationHelper(tab, "#btnNext");
            }

            if (j == 0) {
                console.log("Starting download");
                firstPromise = realDownload(href, episodeNo, agent, downloadPath);
            }
            else
                linkArr.push({ href, episodeNo, agent });

        }

        firstPromise.then(async function () {
            for (let i = 0; i < linkArr.length; i++) {
                await realDownload(linkArr[i].href, linkArr[i].episodeNo, linkArr[i].agent, downloadPath);
            }
            console.log("Episodes Downloaded");
        })

    } catch (err) {
        console.log(err.message);
    }
}

async function downloadEpisodeParallel(tab, link, totalDownload, downloadPath) {
    try {

        await tab.goto(link, { waitUntil: "networkidle0" });
        let episodeDownloadedArr = [];
        for (let j = 0; j < totalDownload; j++) {
            await tab.waitForSelector("#navsubbar");
            await handleAds2(tab);

            await scrollToBottom(tab);
            await tab.waitFor(3000);

            let curl = tab.url();
            let episode = curl.split("/").pop();
            let episodeNo = episode.split("?")[0];

            // await tab.waitForSelector("#divDownload a");
            let href = await hrefFinder(tab);
            if(j == 0)
                console.log("Starting download");
            let agent;
            if (href.includes("mp4"))
                agent = new https.Agent({ rejectUnauthorized: false });
            else
                agent = new https.Agent({ keepAlive: true });

            if (j != totalDownload - 1) {
                await tab.waitForSelector("#btnNext");
                await navigationHelper(tab, "#btnNext");
            }

            let episodeWillBeDownloadedPromise = realDownload(href, episodeNo, agent, downloadPath);
            episodeDownloadedArr.push(episodeWillBeDownloadedPromise);

        }

        let finalPromise = Promise.all(episodeDownloadedArr);
        finalPromise.then(() => {
            console.log("Episodes downloaded.");
        });

    } catch (err) {
        console.log(err.message);
    }

    // "https://scontent.xx.fbcdn.net/v/t39.24130-2/10000000_249967709619292_3107104157604519756_n.mp4?_nc_cat=104&_nc_sid=985c63&efg=eyJ2ZW5jb2RlX3RhZyI6Im9lcF9oZCJ9&_nc_ohc=SRUE2OS7CzQAX8C4d4a&_nc_ht=video-yyz1-1.xx&oh=73ca293464bc7c3a200b45e8bfb812a0&oe=5EFFBD0D&jparams=MTAzLjk1LjEyMi4yNTQ=&upx=TW96aWxsYS81LjAgKFgxMTsgTGludXggeDg2XzY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvODMuMC40MTAzLjYxIFNhZmFyaS81MzcuMzY="

}

async function realDownload(url, episodeNo, agent, downloadPath) {
    const { data, headers } = await axios({
        url,
        method: 'GET',
        httpsAgent: agent,
        responseType: 'stream'
    });

    const totalLength = headers['content-length'];

    const progressBar = multi.newBar(`-> downloading ${episodeNo} [:bar] :percent :etas`, {
        width: 40,
        complete: "❱",
        incomplete: ' ',
        renderThrottle: 1,
        total: parseInt(totalLength)
    });

    const writer = fs.createWriteStream(path.join(downloadPath, `${episodeNo}.mp4`));

    data.on('data', (chunk) => {
        if (progressBar.tick) {
            progressBar.tick(chunk.length);
        }
    });
    data.pipe(writer);

    return new Promise(function (resolve, reject) {
        writer.on('finish', function () {
            writer.close(resolve);
        })

        writer.on('error', function (err) {
            fs.unlink(path.join(downloadPath, `${episodeNo}.mp4`));
            reject(err);
        })
    })
}

async function scrollToBottom(page) {
    const distance = 500; // should be less than or equal to window.innerHeight
    const delay = 100;
    while (await page.evaluate(() => document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight)) {
        await page.evaluate((y) => { document.scrollingElement.scrollBy(0, y); }, distance);
        await page.waitFor(delay);
    }
}