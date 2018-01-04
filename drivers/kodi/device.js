'use strict'

// External libs
const Homey = require('homey')
const KodiWs = require('node-kodi-ws')
const Player = require('../../lib/player.js')

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

    _connectKodi(ipAddress, port) {
        this.log('_connectKodi (', ipAddress, ',', port, ')')
        let device = this
        KodiWs(ipAddress, port)
            .then ((kodi) => {          
                device.log('Connected to ', ipAddress)                          
                
                // Delete the timer after succesful connection
                if(device.reconnectTimer) {
                    // TODO Trigger flow
                    clearInterval(device.reconnectTimer)
                }
                
                // Initialise connection polling
                let fnReconnect = function() {                    
                    // Check if we are already polling
                    if(!device.reconnectTimer) {
                        device.log('Connection lost to ', ipAddress)
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
                device._player.on('pause', () => {device._OnPause})
                device._player.on('stop', () => {device._OnStop})

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

    /************************************
        EPISODES
    ************************************/

    /************************************
        MUSIC
    ************************************/

    /************************************
        ADDONS
    ************************************/

    /***********************************
        PLAYBACK
    ************************************/

    /************************************
        EVENTS
    ************************************/
    _OnPause () {
        console.log('Device._onPause')
        this.log('onPause()')
        let driver = this.getDriver()
        driver._flowTriggerKodiPause
            .trigger(this, null, null)
    }

    _OnStop () {
        this.log('onStop()')
        let driver = this.getDriver()
        driver._flowTriggerKodiStop
            .trigger(this, null, null)
    }
}

module.exports = KodiDevice