'use strict'

const Homey = require('homey')
const bonjour = require('bonjour')()
const net = require('net')

class KodiDriver extends Homey.Driver {
  onInit() {
    // Register flow triggers
    this._flowTriggerKodiMovieStart = new Homey.FlowCardTriggerDevice('kodi_movie_start')
      .register()

    this._flowTriggerKodiMovieStop = new Homey.FlowCardTriggerDevice('kodi_movie_stop')
      .register()

    this._flowTriggerKodiSongStart = new Homey.FlowCardTriggerDevice('kodi_song_start')
      .register()

    this._flowTriggerKodiEpisodeStart = new Homey.FlowCardTriggerDevice('kodi_episode_start')
      .register()

    this._flowTriggerKodiEpisodeStop = new Homey.FlowCardTriggerDevice('kodi_episode_stop')
      .register()  

    this._flowTriggerKodiPlayingSomething = new Homey.FlowCardTriggerDevice('kodi_playing_something')
      .register()

    this._flowTriggerKodiReconnects = new Homey.FlowCardTriggerDevice('kodi_reconnects')
      .register()

    this._flowTriggerKodiPause = new Homey.FlowCardTriggerDevice('kodi_pause')
      .register()

    this._flowTriggerKodiResume = new Homey.FlowCardTriggerDevice('kodi_resume')
      .register()

    this._flowTriggerKodiStop = new Homey.FlowCardTriggerDevice('kodi_stop')
      .register()

    this._flowTriggerKodiHibernate = new Homey.FlowCardTriggerDevice('kodi_hibernate')
      .register()

    this._flowTriggerKodiReboot = new Homey.FlowCardTriggerDevice('kodi_reboot')
      .register()

    this._flowTriggerKodiShutdown = new Homey.FlowCardTriggerDevice('kodi_shutdown')
      .register()

    this._flowTriggerKodiWake = new Homey.FlowCardTriggerDevice('kodi_wake')
      .register()
  }

  // Pairing functionality
  onPairListDevices (data, callback) {
    this.log('onPairListDevices')      

    let devices = []

    // Find local kodi devices.
    bonjour.find({type: 'xbmc-jsonrpc', protocol: 'tcp'}, function(kodiDevice){
      Homey.ManagerArp.getMAC(kodiDevice.addresses[0]) // Find mac address for device ID
        .then((mac) => {
          devices.push(
            {
              name: kodiDevice.name,
              data: {
                id: mac
              },
              settings: {
                host: kodiDevice.addresses[0],
                tcpport: kodiDevice.port
              }
            }        
          )
        })
    })    
    
    // Call the frontend, use timeout to make sure devices are filled because bonjour searches asynchronously
    setTimeout( () => {
        callback(null, devices)
    }, 5000)
  }
}

module.exports = KodiDriver

