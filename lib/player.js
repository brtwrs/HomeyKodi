'use strict'
const EventEmitter = require('events')

class Player extends EventEmitter {

    constructor(kodiConnection) {
        super()
        this._kodiConnection = kodiConnection

        // Pass events
        this._kodiConnection.notification('Player.OnPause', this._onPause)
        this._kodiConnection.notification('Player.OnStop', this._onStop)
    }

    // Actions
    playMovie(movie) {

    }

    // Events
    _onPause(result) {   
        console.log('Player._onPause')     
        this._state = 'paused'
        this.emit('pause')
        console.log('na emit')
    }

    _onStop(result) {
        console.log('Player._onStop')
        this.emit('stop')
        // Check if the user stopped a movie/episode halfway or whether the episode/movie actually ended
        if (result.data.end === true) {
            if (result.data.item.type === 'episode' || result.data.item.type === 'episodes') {
            // Episode ended
            // Get Episode details
            let episodeParams = {
                episodeid: result.data.item.id,
                properties: ['showtitle', 'season', 'episode', 'title']
            }
            this._kodiConnection.run('VideoLibrary.GetEpisodeDetails', episodeParams)
                .then((episodeResult) => {
                    // Trigger action kodi_episode_start
                    console.log('episode_stop (' + device.id + '), tvshow_title: ', episodeResult.episodedetails.showtitle, 'episode_title: ', episodeResult.episodedetails.label, 'season: ', episodeResult.episodedetails.season, 'episode: ', episodeResult.episodedetails.episode)
                    this.emit('episode_stop'
                        ,episodeResult.episodedetails.showtitle
                        ,episodeResult.episodedetails.label
                        ,episodeResult.episodedetails.season
                        ,episodeResult.episodedetails.episode
                    )
                })
            } 
            else {
                // A movie ended
                let movieParams = {
                    movieid: result.data.item.id,
                    properties: ['title']
                }
                // Else get the title by id
                this._kodiConnection.run('VideoLibrary.GetMovieDetails', movieParams)
                    .then((movieResult) => {
                        console.log('movie_stop(' + device.id + '), movie_title: ', movieResult.moviedetails.label, 'device: ', device.device_data)
                        // Trigger event
                        this.emit('movie_stop', movieResult.moviedetails.label)
                    })
            }
        }
    }
}

module.exports = Player