let puppeteer = require("puppeteer");
let fs = require("fs");
var axios = require("axios");
var ProgressBar = require("progress");
var Multiprogress = require("multi-progress")(ProgressBar);
var readline = require('readline');
const ora = require('ora');

const multi = new Multiprogress(process.stderr);

let credentialsFile = process.argv[2];
//cfhdojbkjhnklbpkdaibdccddilifddb - adblocker extension id

var reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

var spinner;

var anime, se, ee;
reader.question('Enter the name of anime : ', function (name) {
    anime = name;
    reader.question("From which episode you want to download : ", function (episode) {
        se = episode;
        reader.question("To which episode you want to download : ", function (end) {
            ee = end;
            reader.close();
            spinner = ora().start();

            spinner.color = 'red';
            spinner.text = 'Loading website';
            spinner.spinner = 'bouncingBall';
            start(anime, se, ee);
        })
    })
})

async function start(anime, se, ee) {
    try {
        let browser = await puppeteer.launch({
            product: "chrome",
            headless: false,
            defaultViewport: null,
            executablePath: "/usr/bin/google-chrome-stable",
            args: ["--start-maximized",
                // "--disable-extensions-except='.config/google-chrome/Default/Extensions/cfhdojbkjhnklbpkdaibdccddilifddb/3.8.4_0/'",
                // "--load-extension='.config/google-chrome/Default/Extensions/cfhdojbkjhnklbpkdaibdccddilifddb/'"
            ],
            slowMo: 100
        })

        let tabs = await browser.pages();
        let tab = tabs[0];

        await loginHelper(tab, browser);

        await tab.waitForSelector("#keyword");
        await tab.type("#keyword", anime, { delay: 50 });
        await tab.waitForSelector("#result_box a", { visible: true });
        let suggestions = await tab.$$("#result_box a");
        await navigationHelper(tab, null, suggestions[0]);

        await tab.waitForSelector("tbody a");
        let episodeLinks = await tab.$$("tbody a");
        let l = episodeLinks.length;
        let ei = l - se;
        let episodesToDownload = ee - se + 1;

        let href = await tab.evaluate(function (anchor) {
            return anchor.getAttribute("href");
        }, episodeLinks[ei]);

        let chref = "https://kissanime.ru" + href;
        await downloadEpisode(tab, chref, episodesToDownload);

    } catch (err) {
        console.log(err.message);
    }

}


async function loginHelper(tab, browser) {
    try {
        let data = await fs.promises.readFile(credentialsFile, "utf-8");
        let credentials = JSON.parse(data);
        let username = credentials.username;
        let pwd = credentials.pwd;
        let url = credentials.url;

        await tab.goto(url, { waitUntil: "networkidle0" });
        await tab.waitForSelector("#topHolderBox a");
        spinner.stop();
        let loginlinks = await tab.$$("#topHolderBox a");

        await Promise.all([
            new Promise(resolve => tab.once('popup', resolve)),
            navigationHelper(tab, null, loginlinks[0])
        ]);
        await handleAds(browser);

        await tab.waitForSelector("#username");
        // let ftime = Date.now() + 3000;
        // while (Date.now() < ftime) { }
        await tab.type("#username", username, { delay: 50 });
        await tab.type("#password", pwd, { delay: 50 });
        await navigationHelper(tab, "#btnSubmit");

        console.log("User logged in");


    } catch (err) {
        console.log(err.message);
    }
}

async function navigationHelper(tab, selector, element) {
    if (selector != null) {
        await Promise.all([tab.waitForNavigation({
            waitUntil: "networkidle0"
        }),
        tab.click(selector)]);
    } else {
        await Promise.all([tab.waitForNavigation({
            waitUntil: "networkidle0"
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

async function handleAds(browser) {
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

async function downloadEpisode(tab, link, totalDownload) {
    try {

        await tab.goto(link, { waitUntil: "networkidle0" });
        let episodeDownloadedArr = [];
        for (let j = 0; j < totalDownload; j++) {
            await tab.waitForSelector("#navsubbar");

            await scrollToBottom(tab);
            await tab.waitFor(3000);

            await tab.waitForSelector("#divDownload a");
            let dLink = await tab.$("#divDownload a");
            let href = await tab.evaluate(function (anchor) {
                return anchor.getAttribute("href");
            }, dLink);

            let curl = tab.url();
            let episode = curl.split("/").pop();
            let episodeNo = episode.split("?")[0];
            console.log("Starting download");
            let episodeWillBeDownloadedPromise = realDownload(href, episodeNo);
            episodeDownloadedArr.push(episodeWillBeDownloadedPromise);

            if (j != totalDownload - 1) {
                await tab.waitForSelector("#btnNext");
                await navigationHelper(tab, "#btnNext");
            }
        }

        await Promise.all(episodeDownloadedArr);
        console.log("Episodes downloaded.");

    } catch (err) {
        console.log(err.message);
    }

    // "https://scontent.xx.fbcdn.net/v/t39.24130-2/10000000_249967709619292_3107104157604519756_n.mp4?_nc_cat=104&_nc_sid=985c63&efg=eyJ2ZW5jb2RlX3RhZyI6Im9lcF9oZCJ9&_nc_ohc=SRUE2OS7CzQAX8C4d4a&_nc_ht=video-yyz1-1.xx&oh=73ca293464bc7c3a200b45e8bfb812a0&oe=5EFFBD0D&jparams=MTAzLjk1LjEyMi4yNTQ=&upx=TW96aWxsYS81LjAgKFgxMTsgTGludXggeDg2XzY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvODMuMC40MTAzLjYxIFNhZmFyaS81MzcuMzY="

}

async function realDownload(url, episodeNo) {
    const { data, headers } = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    const totalLength = headers['content-length'];

    const progressBar = multi.newBar(`-> downloading ${episodeNo} [:bar] :percent :etas`, {
        width: 40,
        complete: "😂",
        incomplete: ' ',
        renderThrottle: 1,
        total: parseInt(totalLength)
    });

    const writer = fs.createWriteStream(`/home/manoj/Downloads/${episodeNo}.mp4`);

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
            fs.unlink(`/home/manoj/Downloads/${episodeNo}.mp4`);
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