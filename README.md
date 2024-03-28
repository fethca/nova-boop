# Nova Boop

Nova Boop is an application designed to crawl the [Radio Nova](https://www.nova.fr/c-etait-quoi-ce-titre/) history every 30 minutes and upload the found tracks to a specified Spotify playlist. It's based on Puppeteer.

## Prerequisites

Before installing Nova Boop, ensure you have the following prerequisites met:

- Node.js installed on your system
- Yarn package manager installed
- Access to a Redis instance
- A Spotify playlist where tracks will be uploaded
- A Spotify access token for the playlist (See the [Spotify access token](#get-a-spotify-access-token) section below for details)

### Installation

To install the required node modules for Nova Boop, run the following command:

```sh
yarn install
```

### Environment Setup

Create a `.env` file at the root directory of your project and include the following environment variables:

```
APP_STAGE=dev

SPOTIFY_ID=your_spotify_id
SPOTIFY_PLAYLIST=your_spotify_playlist
SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token
SPOTIFY_SECRET=your_spotify_secret

REDIS_HOST=localhost
REDIS_PORT=6379
```

### Get a Spotify Access Token

To obtain a Spotify access token:

1. Register your application at [Spotify for Developers](https://developer.spotify.com/dashboard).
2. Generate your Client ID and Client Secret from the dashboard settings.
3. Clone the Spotify [web-api-examples](https://github.com/spotify/web-api-examples) repository:

   ```sh
   git clone git@github.com:spotify/web-api-examples.git
   ```

4. Follow the documentation in the [Spotify Authorization Code example](https://github.com/spotify/web-api-examples/tree/master/authorization/authorization_code).
5. Run the example app and navigate to `http://localhost:8888` to connect and obtain a token.

## Running the Application

To run Nova Boop in watch mode (with the debugger listening on port `9999`), execute:

```sh
yarn start:dev
```

If necessary, attach a debugger by using the `Debug` configuration in `.vscode/launch.json`.

## Known Issues

- Radio Nova's "load more" functionality can sometimes skip tracks. To adjust, modify the `wait(milliseconds)` values inside the [NovaJob](https://github.com/fethca/nova-boop/blob/main/src/jobs/NovaJob.ts#L143).
- Spotify enforces a rate limit policy. The application has successfully scraped up to 3000 tracks without exceeding the quotas, which is about 6000 requests. If you attempt to scrape more tracks, you may reach limitations. For more information, see [Rate Limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits).
- Spotify servers can sometimes be unreliable. To mitigate this, an in-memory playlist is used for its relatively small size and simplicity. Additionally, a basic retry mechanism on startup attempts to fetch the playlist. However, the application may fail on startup due to Spotify's server relative robustness.
