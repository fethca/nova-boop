import { Store } from '@fethcat/store'
import SpotifyWebApi from 'spotify-web-api-node'
import { settings } from './settings.js'

export const store = new Store()

export const spotifyService = new SpotifyWebApi({
  clientId: settings.spotify.id,
  clientSecret: settings.spotify.secret,
})
