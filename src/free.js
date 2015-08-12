var combinators = require('fantasy-combinators'),
    daggy = require('daggy'),
    sorcery = require('fantasy-sorcery'),

    Either = require('fantasy-eithers'),
    Coyoneda = require('./coyoneda'),

    compose = combinators.compose,
    constant = combinators.constant,
    point    = sorcery.point,

    Free = daggy.taggedSum({
        Return:  ['x'],
        Suspend: ['x'],
        Chain:   ['x', 'f']
    });

Free.of = Free.Return;

Free.liftF = function(c) {
    return Free.Suspend(c.map(Free.Return));
};

Free.liftFC = function(c) {
    return Free.liftF(Coyoneda.lift(c));
};

Free.runFC = function(m, f, p) {
    return m.foldMap(p, function(coyo) {
        return f(coyo.x).map(coyo.f);
    });
};

Free.prototype.chain = function(f) {
    var self = this,
        val = function() {
            return Free.Chain(self, f);
        };

    return this.cata({
        Return: val,
        Suspend: val,
        Chain: function(y, g) {
            return Free.Chain(y, function(x) {
                return Free.Chain(g(x), f);
            });
        },
    });
};

Free.prototype.ap = function(x) {
    return this.chain(function(f) {
        return x.map(f);
    });
};

Free.prototype.map = function(f) {
    return this.chain(compose(Free.of)(f));
};

Free.prototype.andThen = function(x) {
    return this.chain(constant(x));
};

Free.prototype.fold = function(f, g) {
    return this.resume().fold(f, g);
};

Free.prototype.foldMap = function(p, f) {
    return this.resume().cata({
        Left: function(x) {
            return f(x).chain(function(y) {
                return y.foldMap(p, f);
            });
        },
        Right: function(x) {
            return point(p, x);
        }
    });
};

Free.prototype.resume = function() {
    return this.cata({
        Return:  Either.Right,
        Suspend: Either.Left,
        Chain: function(x, f) {
            return x.cata({
                Return: function(y) {
                    return f(y).resume();
                },
                Suspend: function(y) {
                    return Either.Left(y.map(function(z) {
                        return z.chain(f);
                    }));
                },
                Chain: function(y, g) {
                    return y.chain(function(z) {
                        return g(z).chain(f);
                    }).resume();
                }
            });
        }
    });
};

// Export
if (typeof module != 'undefined')
    module.exports = Free;
