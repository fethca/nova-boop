import SpotifyWebApi from 'spotify-web-api-node'
import { settings } from '../settings.js'

export const spotifyService = new SpotifyWebApi({
  clientId: settings.spotify.id,
  clientSecret: settings.spotify.secret,
})

export const connectSpotify = async () => {
  spotifyService.setRefreshToken(settings.spotify.refresh_token)
  await spotifyService
    .refreshAccessToken()
    .then((data) => {
      spotifyService.setAccessToken(data.body['access_token'])
    })
    .catch((error) => {
      throw error
    })
}
