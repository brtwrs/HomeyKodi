'use strict'

// External libs
const Homey = require('homey')
const KodiWs = require('node-kodi-ws')
const Player = require('../../lib/player.js')
const Library = require('../../lib/library.js')
const System = require('../../lib/system.js')

// Global config
const RECONNECT_INTERVAL = 10000

class KodiDevice extends Homey.Device {
    onInit() {
        this.log('init(', this.getData().id, ')')
        let host = this.getSetting('host')
        let tcpPort = this.getSetting('tcpport')
        
        this._connectKodi(host, tcpPort)  
    }

    onAdded() {
        this.log('added()')
    }

    onDeleted() {
        this.log('deleted()')
        // Remove listeners
        if (this.kodi.socket) {
            this._kodi.socket.removeAllListeners()
        }
        this._kodi.removeAllListeners()
        if(this.reconnectTimer) {
            clearInterval(this.reconnectTimer)
        }
    }

    _connectKodi (ipAddress, port) {
        this.log('_connectKodi (', ipAddress, ',', port, ')')
        let device = this
        KodiWs(ipAddress, port)
            .then ((kodi) => {          
                device.log('Connected to ', ipAddress)                          
                
                // Delete the timer after succesful connection
                if(device.reconnectTimer) {                    
                    clearInterval(device.reconnectTimer)
                    // Trigger flow
                    let driver = device.getDriver()
                    driver._flowTriggerKodiReconnects
                        .trigger(device, null, null)
                }
                
                // Initialise connection polling
                let fnReconnect = function(error) {                    
                    // Check if we are already polling
                    if(!device.reconnectTimer) {
                        device.log('Connection lost to ', ipAddress)
                        device.error(error)
                        device.setUnavailable()
                        device.reconnectTimer = 
                            setTimeout( (ipAddress, port) => {
                                device._connectKodi(ipAddress, port)
                            }, RECONNECT_INTERVAL, ipAddress, port) // Start polling
                    }                    
                }

                // Register event listeners
                kodi.on('close', fnReconnect)
                kodi.on('error', fnReconnect)

                // Register objects and events to interact with kodi
                device._player = new Player(kodi)
                device._player.on('pause', () => { device._onPause() })
                device._player.on('stop', () => { device._onStop() })
                device._player.on('episode_stop', (episode) => { device._onEpisodeStop(episode) })
                device._player.on('movie_stop', (movie) => { device._onMovieStop(movie) })
                device._player.on('play', () => { device._onPlay() })
                device._player.on('resume', () => { device._onResume() })
                device._player.on('movie_start', (movie) => { device._onMovieStart(movie) })
                device._player.on('episode_start', (episode) => { device._onEpisodeStart(episode) })
                device._player.on('song_start', (song) => { device._onSongStart(song) })

                device._library = new Library(kodi)

                device._system = new System(kodi)
                device._system.on('shutdown', () => { device._onShutdown() })
                device._system.on('hibernate', () => { device._onHibernate() })
                device._system.on('reboot', () => { device._onReboot() })
                device._system.on('wake', () => { device._onWake() })

                device.setAvailable() // Make available to Homey
            })
            .catch((err) => {
                device.error(err)
                device.setUnavailable(err)
                device.reconnectTimer = 
                    setTimeout( (ipAddress, port) => {
                        device._connectKodi(ipAddress, port)
                    }, RECONNECT_INTERVAL, ipAddress, port) // Start polling                
            })
    }

    /************************************
        MOVIE
    ************************************/
    playMovie (movieTitle) {
        this.log('playMovie(', movieTitle, ')')
        return this._library.searchMovie(movieTitle)
            .then ( (movie) => {
                return this._player.playMovie(movie)     
            })
    }    

    /************************************
        EPISODES
    ************************************/
    playLatestUnwatchedEpisode (showTitle) {
        this.log('playLatestUnwatchedEpisode(', showTitle, ')')
        return this._library.getLatestUnwatchedEpisode(showTitle)
            .then( (episode) => {
                return this._player.playEpisode(episode)
            })
    }
    /************************************
        MUSIC
    ************************************/
    playMusic (searchType, searchQuery, shuffle = true) {
        this.log('playMusic(', searchType, ',', searchQuery, ')')
        return this._library.searchMusic(searchType, searchQuery)
            .then ( (songs) => {
                return this._player.playMusic(songs, shuffle)
            })
    }

    setPartyMode () {
        this.log('setPartyMode()')
        return this._player.setPartyMode()
    }

    /************************************
        ADDONS
    ************************************/
    startAddon (addonName) {
        this.log('startAddon (', addonName, ')')
        return this._library.searchAddon(addonName)
            .then( (addon) => {
                return this._player.startAddon(addon)
            })
    }

    /***********************************
        PLAYBACK
    ************************************/
    nextOrPrevious (nextOrPrevious) {
        this.log('previousOrNext(', nextOrPrevious, ')')
        return this._player.nextOrPrevious(nextOrPrevious)
    }

    setMute (onOff) {
        this.log('setMute(', onOff, ')')
        return this._player.setMute(onOff)
    }

    setSubtitle (onOff) {
        this.log('setSubtitle(', onOff, ')')
        return this._player.setSubtitle(onOff)
    }

    setVolume (volume) {
        this.log('setVolume(', volume, ')')
        return this._player.setVolume(volume)
    }
    
    pauseResume () {
        this.log('playPause()')
        return this._player.pauseResume()
    }

    stop () {
        this.log('stop()')
        return this._player.stop()
    }

    /************************************
        SYSTEM
    ************************************/
    reboot () {
        this.log('reboot()')
        return this._system.reboot()
    }

    hibernate () {
        this.log('hibernate()')
        return this._system.hibernate()
    }

    shutdown () {
        this.log('shutdown()')
        return this._system.shutdown()
    }

    /************************************
        EVENTS
    ************************************/
    _onPause () {
        this.log('_onPause()')
        let driver = this.getDriver()
        driver._flowTriggerKodiPause
            .trigger(this, null, null)
    }

    _onStop () {
        this.log('_onStop()')
        let driver = this.getDriver()
        driver._flowTriggerKodiStop
            .trigger(this, null, null)
    }

    _onEpisodeStop (episode) {
        this.log('_onEpisodeStop(', episode, ')')
        let driver = this.getDriver()
        driver._flowTriggerKodiEpisodeStop
            .trigger(this, episode.getParamFlow(), null)    
    }

    _onMovieStop (movie) {
        this.log('_onMovieStop(', movie, ')')
        let driver = this.getDriver()
        driver._flowTriggerKodiMovieStop
            .trigger(this, movie.getParamFlow(), null)        
    }

    _onPlay () {
        this.log('_onPlay()')
        let driver = this.getDriver()
        driver._flowTriggerKodiPlayingSomething
            .trigger(this, null, null)
    }

    _onResume () {
        this.log('_onResume()')
        let driver = this.getDriver()
        driver._flowTriggerKodiResume
            .trigger(this, null, null)
    }

    _onMovieStart (movie) {
        this.log('_onMovieStart(', movie, ')')
        let driver = this.getDriver()
        driver._flowTriggerKodiMovieStart
            .trigger(this, movie.getParamFlow(), null)
    }

    _onEpisodeStart (episode) {
        this.log('_onEpisodeStart(', episode,')')
        let driver = this.getDriver()
        driver._flowTriggerKodiEpisodeStart
            .trigger(this, episode.getParamFlow() , null)
    }

    _onSongStart (song) {
        this.log('_onSongStart(', song, ')')
        let driver = this.getDriver()
        driver._flowTriggerKodiSongStart
            .trigger(this, song.getParamFlow(), null)
    }

    _onShutdown () {
        this.log('_onShutdown()')
        let driver = this.getDriver()
        driver._flowTriggerKodiShutdown
            .trigger(this, null, null)
    }

    _onHibernate () {
        this.log('_onHibernate()')
        let driver = this.getDriver()
        driver._flowTriggerKodiHibernate
            .trigger(this, null, null)
    }

    _onReboot () {
        this.log('_onReboot()')
        let driver = this.getDriver()
        driver._flowTriggerKodiReboot
            .trigger(this, null, null)
    }

    _onWake () {
        this.log('_onWake()')
        let driver = this.getDriver()
        driver._flowTriggerKodiWake
            .trigger(this, null, null)
    }
}

module.exports = KodiDevice