// One-time helper to obtain a Google Drive refresh token for tenant document
// uploads. Prerequisites (Google Cloud Console, one-time):
//   1. Create a project and enable the Google Drive API.
//   2. Configure the OAuth consent screen (External) and PUBLISH it to
//      Production — otherwise the refresh token expires after 7 days.
//   3. Create an OAuth client (type: Web application) with
//      http://127.0.0.1:53682 as an authorized redirect URI.
//   4. Put GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in .env.local.
// Then: bun run get-drive-token  (sign in as the Gmail account that should own
// the files) and copy the printed GOOGLE_DRIVE_REFRESH_TOKEN into .env.local.
import { google } from 'googleapis';

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in .env.local first.');
  process.exit(1);
}

const PORT = 53682;
const oauth2 = new google.auth.OAuth2(clientId, clientSecret, `http://127.0.0.1:${PORT}`);

const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
});

console.log('Open this URL in your browser and sign in with the 8TURF Gmail account:\n');
console.log(url);
console.log('\nWaiting for Google to redirect back…');

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const code = new URL(req.url).searchParams.get('code');
    if (!code) return new Response('Missing ?code parameter', { status: 400 });

    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      console.error('\nNo refresh token returned — remove the app at');
      console.error('https://myaccount.google.com/permissions and run this script again.');
      setTimeout(() => process.exit(1), 100);
      return new Response('No refresh token returned. See terminal.', { status: 500 });
    }

    console.log('\nAdd this to .env.local (and to Vercel for production):\n');
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
    setTimeout(() => process.exit(0), 100);
    return new Response('Refresh token printed in the terminal. You can close this tab.');
  },
});
