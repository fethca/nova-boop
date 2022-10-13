import { Axios } from './axios'

const uri = 'https://api.deezer.com'

export class DeezerService {
  constructor() {}

  async getPlaylist(playlist_id: string) {
    return Axios.get(`${uri}/playlist/${playlist_id}`)
  }

  async getPlaylistTracks(playlist_id: string) {
    return Axios.get(`${uri}/playlist/${playlist_id}/tracks`)
  }

  async updatePlaylistTracks(playlist_id: string, trackIds: string[]) {
    return Axios.post(`${uri}/playlist/${playlist_id}/tracks`, trackIds)
  }

  async removeTracksFromPlaylist(playlist_id: string, trackIds: string[]) {
    return Axios.delete(`${uri}/playlist/${playlist_id}/tracks`, { data: trackIds })
  }
}
