var domain = require('couch-ar');

exports.TestUser = domain.create('Another',{
    properties:{
        username: {},
        password: {},
        firstName:{},
        lastName: {},
        fullName: {}
    }
}, function(that) {
    that.beforeSave = function() {
        that.fullName = that.firstName + ' ' + that.lastName;
    }
    return that;
});


