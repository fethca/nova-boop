import { Store } from '@fethcat/store'
import { settings } from '../settings.js'
import { SpotifyService } from './spotify.js'

export const store = new Store()

export const spotifyService = new SpotifyService({
  clientId: settings.spotify.id,
  clientSecret: settings.spotify.secret,
})
