import type { Auth } from 'googleapis';

function loadGoogle() {
  return require('googleapis') as typeof import('googleapis');
}

/** Loads googleapis on first use so dev startup does not parse the whole SDK. */
export function createGoogleOAuth2(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Auth.OAuth2Client {
  const { google } = loadGoogle();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function createGoogleOAuth2UserInfoClient(auth: Auth.OAuth2Client) {
  const { google } = loadGoogle();
  return google.oauth2({ version: 'v2', auth });
}

export function createGoogleCalendarClient(auth: Auth.OAuth2Client) {
  const { google } = loadGoogle();
  return google.calendar({ version: 'v3', auth });
}
