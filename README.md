# myAnimeDownloader
It is a web automation script which takes as input anime name and the range of episodes you want to download, and then opens the website www.kissanime.ru/ searches the anime name and downloads the episodes in your hard drive. The only manual thing you have to do is answer the captcha to prove you're human. That's it.

# How to run the script
Create a file named "credentials.json" which will contain the following content : 

{
    "username" : "username",
    "pwd" : "password",
    "executablePath" : "executablePathForChrome"
}

Replace username and password with your username and password of the account that you will have to create on the kissanime website and 4anime website.

If you want to run code in chromium then just leave "executablePath" property empty. For eg- 
"executablePath" : ""

If you want to run code in chrome then you have to enter the path for your chrome. For eg - 

In Linux - 
"executablePath" : "/usr/bin/google-chrome-stable"

In Windows - 
"executablePath" : "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

It can be different for your system so please don't copy this path.

#How to run the code

Make sure that run "npm install" before running it and make sure the "credentials.json" file is in the same directory as rest of the script files.

Below are the commands you have to run :-

For Linux - 
chmod +x pep.sh (You have to run this command if you are running code for first time.)
./pep.sh (Code will run with this command).

For Windows - 
pep.bat

When entering download path, enter absolute path instead of relative path.
When entering website choice, I will prefer 4anime because it contains less issues like ads etc. and it downloads episodes in 1080p by default. Always keep kissanime as second choice.
I added kissanime support because 4anime does not contains recently released animes.
While downloading from kissanime you have to answer the captcha and sometimes it opens new windows which have to be closed manually and it ruins the fun of automation. So prefer 4anime.

To stop the execution, press Ctrl + C.
That's it. Thank you.
