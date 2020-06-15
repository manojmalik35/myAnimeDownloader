# myAnimeDownloader
It is a web automation script which takes as input anime name and the range of episodes you want to download, and then opens the website www.kissanime.ru/ searches the anime name and downloads the episodes in your hard drive. The only manual thing you have to do is answer the captcha to prove you're human. That's it.

# How to run the script
Create a file named "credentials.json" which will contain the following content : 

{
    "username" : "<username>",
    "pwd" : "<password>",
    "url" : "https://kissanime.ru/"
}

Replace <username> and <password> with your username and password of the account that you will have to create on the kissanime websit.

#For linux users 
just run the command :- ./pep.sh

#For Windows users
Run the command :- node main "credentials.json"

Make sure that run "npm install" before running it and make sure the "credentials.json" file is in the same directory.

That's it. Thank you.
