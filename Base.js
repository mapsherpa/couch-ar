/**
 * The base constructor that is extended by each domain constructor
 * Contains the basic methods save/remove...
 */
"use strict";
module.exports = function(db, name, config) {
    var domain = require('couch-ar');
    var helpers = require('./helpers');
    var that = {};

    configureHasMany();
    configureHasOne();

    that.db = function() {
      return db;
    }
    
    that.saveAttachment = function(opts, callback) {
      if (!callback) {
        throw new Error('setAttachment called without callback function.');
      }
      opts = opts || {};
      if (!opts['name']) {
        return callback("Attachment name not specified");
      }
      if (!opts['contentType']) {
        return callback("Attachment content type not specified");
      }
      if (!opts['body']) {
        return callback("Attachment name body not specified");
      }
      db.saveAttachment(this.id, opts, callback);
    }
    
    that.getAttachment = function(name, callback) {
      if (!this['_attachments']) {
        return callback('Document has no attachments');
      }
      if (!this._attachments[name]) {
        return callback('Document is missing attachment ' + name);
      }
      return callback(null, db.getAttachment(this.id, name, function() {}));
    }

    that.serialize = function() {
        var obj = Object.getOwnPropertyNames(config.properties).reduce(function(obj, prop) {
            obj[prop] = that[prop];
            return obj;
        }, {});
        obj.type = name;
        obj._id = obj.id;
        obj._rev = obj.rev;
        return obj;
    }

    that.save = function(callback) {
        callback = callback || function() {
        }
        that.beforeSave && that.beforeSave();
        var out = that.serialize();
        that.dateCreated = that.dateCreated || new Date();
        that.lastUpdated = new Date();
        db.save(that.id, that.serialize(), function(err, res) {
            if (res && res.ok) {
                that.id = res.id;
                that.rev = res.rev
            }
            if(err) {
                callback(err, res);
            } else {
                that.afterSave ? that.afterSave(res, callback) : callback(err, res);
            }
        });
    }

    that.remove = function(callback) {
        if (that.id) {
            db.remove(that.id, that.rev, function(err, res) {
                that.id = err ? that.id : undefined;
                callback(err, res);
            });
        } else {
            callback();
        }
    }
    return that;

    function configureHasOne() {
        Object.keys(config.hasOne || {}).forEach(function(propName) {
            var model = domain[config.hasOne[propName]];
            var upperPropName = helpers.toUpper(propName);
            var idProp = propName + 'Id';
            config.properties[idProp] = {};
            addSetter();
            addGetter();


            function addSetter() {
                that['set' + upperPropName] = function(it) {
                    if(it && (it.id === undefined)) {
                        throw 'Can not set non-persisted entity to hasOne';
                    }
                    that[idProp] = it && it.id;
                }
            }

            function addGetter() {
                that['get' + upperPropName] = function(cb) {
                    if(that[idProp] !== undefined) {
                        model.findById(that[idProp], cb);
                    } else {
                        cb(undefined);
                    }
                }
            }
        });
    }

    function configureHasMany() {

        Object.keys(config.hasMany || {}).forEach(function(propName){
            var model;
            var singularPropName;
            var propDef = config.hasMany[propName];

            if(typeof propDef === 'object') {
                model = propDef.type && domain[propDef.type];
                singularPropName = propDef.singular;
            } else {
                model = domain[propDef];
            }
            singularPropName = singularPropName || propName.replace(/(.*)s$/,'$1');
            var upperPropName = helpers.toUpper(propName);
            var singularUpperPropName = helpers.toUpper(singularPropName);
            var idsArray = that[singularPropName + 'Ids'] = [];
            addGetter();
            addAdder();
            addRemover();
            config.properties[singularPropName + 'Ids'] = {};

            function addGetter() {
                that['get' + upperPropName] = function(cb) {
                    var count = 0;
                    var things = [];
                    var ids = idsArray.slice(0);
                    ids.length === 0 && cb([]);
                    ids.forEach(function(id) {
                        model.findById(id, function(thing) {
                            things.push(thing);
                            count++;
                            count === ids.length && cb(things);
                        });
                    });
                }
            }

            function addAdder() {
                that['add' + singularUpperPropName] = function(it) {
                    if(it.id === undefined) {
                        throw 'Can not add non-persisted entity to hasMany';
                    }
                    idsArray.indexOf(it.id) === -1 && idsArray.push(it.id);
                }
            }

            function addRemover() {
                that['remove' + singularUpperPropName] = function(it) {
                    var idx = idsArray.indexOf(it.id);
                    if(idx !== -1) {
                        idsArray.splice(idx,1);
                    }
                }
            }
        });
    }
}
