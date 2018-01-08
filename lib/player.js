'use strict'

const EventEmitter = require('events')
const Movie = require('../../lib/movie.js')
const Episode = require('../../lib/episode.js')
const Song = require('../../lib/song.js')
const Homey = require('homey')
const Utils = require('../../lib/utils.js')

class Player extends EventEmitter {

    constructor (kodiConnection) {
        super()
        this._kodiConnection = kodiConnection

        // Pass events
        let player = this
        this._kodiConnection.notification('Player.OnPause', (result) => { player._onPause(result) })
        this._kodiConnection.notification('Player.OnStop', (result) => { player._onStop(result) })
        this._kodiConnection.notification('Player.OnPlay', (result) => { player._onPlay(result) })
    }

    // Actions
    playMovie (movie) {
        Homey.app.log('Player.playMovie(', movie, ')')
        return this._kodiConnection.run('Player.Open', movie.getParamId ())
    }

    playMusic (songs, shuffle) {
        Homey.app.log('Player.playMusic()')
        // Clear the play list
        return this._kodiConnection.run('Playlist.Clear', { playlistid: 0 })
            .then( () => {
                // Convert songs to list of param
                let songParams = songs.map( (song) => {
                    return song.getParamId()
                })

                // Turn on shuffle
                if (shuffle) {
                    songParams = Utils.shuffle(songParams)
                }

                // Add songs to the playlist
                return this._kodiConnection.run('Playlist.Add', { playlistid: 0, item: songParams })
                    .then( () => {
                        // Play the playlist
                        let params = {
                            item: {
                              playlistid: 0
                            },
                            options: {
                              repeat: 'all'
                            }
                        }
                        return this._kodiConnection.run('Player.Open', params)
                    })
            })
    }

    playEpisode (episode) {
        Homey.app.log('Player.playEpisode (', episode, ')')
        return this._kodiConnection.run('Player.Open', episode.getParamId())
    }

    nextOrPrevious (previousOrNext) {
        Homey.app.log('Player.nextOrPreviousTrack(', previousOrNext, ')')
        return this._kodiConnection.run('Player.GetActivePlayers', {})
            .then( (result) => {
                // Check whether there is an active player to perform next/previous
                if(result[0]) {
                    let params = {
                        playerid: result[0].playerid,
                        to: previousOrNext
                    }
                    return this._kodiConnection.run('Player.GoTo', params)
                }
            })
    }

    pauseResume () {
        Homey.app.log('Player.pauseResume()')
        return this._kodiConnection.run('Player.GetActivePlayers', {})
            .then( (result) => {
                if (result[0]) { // Check whether there is an active player to stop
                    return this._kodiConnection.run('Player.PlayPause', { playerid: result[0].playerid })
                } 
            })
    }

    stop () {
        Homey.app.log('Player.stop()')
        return this._kodiConnection.run('Player.GetActivePlayers', {})
            .then( (result) => {
                if (result[0]) { // Check whether there is an active player to stop
                    return this._kodiConnection.run('Player.Stop', { playerid: result[0].playerid })
                } 
            })
    }

    startAddon (addon) {
        Homey.app.log('Player.startAddon(', addon, ')')
        return this._kodiConnection.run('Addons.ExecuteAddon', addon.getParamId())
    }

    setPartyMode () {
        Homey.app.log('Player.setPartyMode()')
        let params = {
            item: {
                'partymode': 'music'
            }
        }
        return this._kodiConnection.run('Player.Open', params)
    }

    setMute (onOff) {
        Homey.app.log('setMute(', onOff, ')')
        return this._kodiConnection.run('Application.SetMute', onOff)
    }

    setSubtitle (onOff) {
        Homey.app.log('Player.setSubtitle(', onOff,')')
        let onOffParam = (onOff) ? 'on' : 'off'
        return this._kodiConnection.run('Player.GetActivePlayers', {})
            .then( (result) => {
                if (result[0]) { // Check whether there is an active player to set the subtitle
                    // Build request parameters and supply the player
                    let params = {
                        playerid: result[0].playerid,
                        subtitle: onOffParam
                    }
                    return this._kodiConnection.run('Player.SetSubtitle', params)
                }
            })
    }

    setVolume (volume) {
        Homey.app.log('setVolume(', volume, ')')
        return this._kodiConnection.run('Application.SetVolume', { volume: volume })
    }

    // Events
    _onPlay (result) {
        Homey.app.log('Player._onPlay')
        this.emit('play')

        let playerId = (result.data.player.playerid === -1) ? 1 : result.data.player.playerid // Convert -1 to 1 if player is an Addon (Exodus / Specto)

        // Grab the current playing item from the
        // Check if there's a new song/movie/episode playback or a resume action (player % > 1)
        // Build request parameters and supply the player
        let params = {
            playerid: playerId, // Convert -1 to 1 if player is an Addon (Exodus / Specto)
            properties: ['percentage']
        }

        this._kodiConnection.run('Player.GetProperties', params)
            .then( (playerResult) => {
                // If the percentage is above 0.1 for eps/movies or above 1  for songs , we have a resume-action
                if (playerResult) {
                    if ((playerResult.percentage >= 0.1 && result.data.item.type !== 'song') || (playerResult.percentage >= 1 && result.data.item.type === 'song')) {
                        this.emit('resume')
                    } else {
                        // Get the current item from the Player to check whether we are dealing with a movie or an episode
                        this._kodiConnection.run('Player.GetItem', { playerid: playerId })
                            .then( (resultGetItem) => {
                                // Check if we're dealing with a movie, episode or song
                                if (resultGetItem.item.type === 'movie' || resultGetItem.item.type === 'movies') {
                                    let movieTitle = (resultGetItem.item.label) ? resultGetItem.item.label : ''
                                    let movieParams = {
                                        movieid: (resultGetItem.item.id) ? resultGetItem.item.id : -1,
                                        properties: ['title']
                                    }
                                    // Else get the title by id
                                    this._kodiConnection.run('VideoLibrary.GetMovieDetails', movieParams)
                                        .then( (movieResult) => {                                        
                                            movieTitle = (movieResult.moviedetails.label) ? movieResult.moviedetails.label : movieTitle
                                            if (movieTitle !== '') {
                                                this.emit('movie_start', new Movie (((resultGetItem.item.id) ? resultGetItem.item.id : -1), movieTitle))                                               
                                            }
                                        })
                                } else if (resultGetItem.item.type === 'episode' || resultGetItem.item.type === 'episodes') {
                                    // Placeholder variables for episode details
                                    let tvshowTitle = (result.data.item.showtitle) ? result.data.item.showtitle : ''
                                    let episodeTitle = (result.data.item.title) ? result.data.item.showtitle : ''
                                    let season = (result.data.item.season) ? result.data.item.season : ''
                                    let episode = (result.data.item.episode) ? result.data.item.episode : ''
                                    // Get Episode details
                                    let episodeParams = {
                                        episodeid: (resultGetItem.item.id) ? resultGetItem.item.id : -1,
                                        properties: ['showtitle', 'season', 'episode', 'title']
                                    }
                                    this._kodiConnection.run('VideoLibrary.GetEpisodeDetails', episodeParams)
                                        .then( (episodeResult) => {
                                            tvshowTitle = (episodeResult.episodedetails.showtitle) ? episodeResult.episodedetails.showtitle : tvshowTitle
                                            episodeTitle = (episodeResult.episodedetails.label) ? episodeResult.episodedetails.label : episodeTitle
                                            season = (episodeResult.episodedetails.season) ? episodeResult.episodedetails.season : season
                                            episode = (episodeResult.episodedetails.episode) ? episodeResult.episodedetails.episode : episode

                                            if (tvshowTitle !== '' && episodeTitle !== '') {
                                                // Trigger action kodi_episode_start
                                                this.emit('episode_start', new Episode (
                                                    ((resultGetItem.item.id) ? resultGetItem.item.id : -1),
                                                    episodeTitle,
                                                    tvshowTitle,
                                                    season,
                                                    episode
                                                ))                                            
                                            }
                                        })                                        
                                    } else if (resultGetItem.item.type === 'song' || resultGetItem.item.type === 'songs') {
                                        // Get song details
                                        let songParams = {
                                            songid: result.data.item.id,
                                            properties: ['artist', 'title']
                                        }
                                        this._kodiConnection.run('AudioLibrary.GetSongDetails', songParams)
                                            .then( (songResult) => {
                                                // Trigger action kodi_song_start
                                                this.emit('song_start', new Song (
                                                    result.data.item.id,
                                                    songResult.songdetails.title,
                                                    songResult.songdetails.artist[0]
                                                ))
                                            })
                                    }
                            })
                    } 
                }
            })
    }

    _onPause (result){   
        Homey.app.log('Player._onPause')     
        this._state = 'paused'
        this.emit('pause')
    }

    _onStop (result) {
        Homey.app.log('Player._onStop')
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
                    Homey.app.log('episode_stop (), tvshow_title: ', episodeResult.episodedetails.showtitle, 'episode_title: ', episodeResult.episodedetails.label, 'season: ', episodeResult.episodedetails.season, 'episode: ', episodeResult.episodedetails.episode)
                    this.emit('episode_stop', new Episode (
                            result.data.item.id,
                            episodeResult.episodedetails.label,
                            episodeResult.episodedetails.showtitle,
                            episodeResult.episodedetails.season,
                            episodeResult.episodedetails.episode
                        )
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
                        Homey.app.log('movie_stop(), movie_title: ', movieResult.moviedetails.label)
                        // Trigger event
                        this.emit('movie_stop', new Movie (result.data.item.id, movieResult.moviedetails.label))
                    })
            }
        }
    }
}

module.exports = Player