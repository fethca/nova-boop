import { settings } from '@src/settings'

const SpotifyWebApi = require('spotify-web-api-node')

export const spotifyService = new SpotifyWebApi({
  clientId: settings.spotify.id,
  clientSecret: settings.spotify.secret,
})
