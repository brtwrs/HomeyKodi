'use strict'

class Movie {
    
    constructor (id, title) {
        this.id = id
        this.title = title
    }
    
    getParamId () {
        return {
            item: {
                movieid: this.id
            }
        }
    }

    getParamFlow () {
        return {
            movie_title: this.title
        }
    }
}
module.exports = Movie