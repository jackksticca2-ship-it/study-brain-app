# Study Brain: iPhone app

This folder is a phone-only version of Study Brain. It runs completely on your
iPhone, with no computer and no internet needed after you install it. Your data is
saved on the phone.

The timer saves the time you pressed Start. It keeps counting while the app is
closed, the screen is locked, or the phone restarts. Open the app again and it
shows the right time. (Nothing on a phone runs while it's fully powered off, but
no time is lost, because the timer counts from when you pressed Start.)

## Step 1: Put it online (one time, free)

The iPhone needs to load the app from a web address once. GitHub Pages hosts it for free:

1. Make a free account at https://github.com and sign in.
2. Click **+ → New repository**. Name it `study-brain`, choose **Public**, and click **Create repository**.
3. Click **uploading an existing file**. Open this `phone` folder on your computer, select
   **everything inside it** (`index.html`, `app.js`, `style.css`, `sw.js`,
   `manifest.webmanifest`, and the `icons` folder), and drag it onto the page.
   Click **Commit changes**.
4. Go to **Settings → Pages**. Under "Branch", choose **main** and **/(root)**, then click **Save**.
5. Wait a minute or two. Your app address is shown at the top of that page, like
   `https://YOUR-USERNAME.github.io/study-brain/`.

Only the app's code goes on GitHub. Your study sessions are never uploaded;
they stay on your phone.

## Step 2: Install it on your iPhone

1. Open the address from step 1 in **Safari**. (It has to be Safari.)
2. Tap the **Share** button (the square with the up arrow).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open **Study Brain** from your home screen. It opens full-screen like a normal app
   and works in airplane mode too.

## Things to know

- **Always use the home-screen icon.** On iPhone, the home-screen app and a Safari tab keep
  **separate** data, so sessions logged in Safari won't show up in the app.
- **Deleting the app from your home screen deletes its data.**
- Data is per device: it won't sync with the computer version or another phone.

## Updating the app later

Most of this folder is generated from the computer version. After changing the brain
scene, page layout, or styles, rebuild it from the main `study-brain` folder:

```powershell
venv\Scripts\python.exe build_phone.py
```

That rewrites `index.html` and `style.css` and bumps the cache version in `sw.js`.
(`app.js` is the phone's own logic and is edited by hand.)

Then upload the changed files to your GitHub repository, replacing the old ones.
On the phone, open the app, close it, and open it again: the new version loads.
Your data stays.
