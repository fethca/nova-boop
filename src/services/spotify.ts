import { settings } from '@src/settings'
import SpotifyWebApi from 'spotify-web-api-node'

export const spotifyService = new SpotifyWebApi({
  clientId: settings.spotify.id,
  clientSecret: settings.spotify.secret,
})
