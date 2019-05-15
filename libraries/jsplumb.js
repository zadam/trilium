/**
 * jsBezier
 *
 * Copyright (c) 2010 - 2017 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * licensed under the MIT license.
 *
 * a set of Bezier curve functions that deal with Beziers, used by jsPlumb, and perhaps useful for other people.  These functions work with Bezier
 * curves of arbitrary degree.
 *
 * - functions are all in the 'jsBezier' namespace.
 *
 * - all input points should be in the format {x:.., y:..}. all output points are in this format too.
 *
 * - all input curves should be in the format [ {x:.., y:..}, {x:.., y:..}, {x:.., y:..}, {x:.., y:..} ]
 *
 * - 'location' as used as an input here refers to a decimal in the range 0-1 inclusive, which indicates a point some proportion along the length
 * of the curve.  location as output has the same format and meaning.
 *
 *
 * Function List:
 * --------------
 *
 * distanceFromCurve(point, curve)
 *
 * 	Calculates the distance that the given point lies from the given Bezier.  Note that it is computed relative to the center of the Bezier,
 * so if you have stroked the curve with a wide pen you may wish to take that into account!  The distance returned is relative to the values
 * of the curve and the point - it will most likely be pixels.
 *
 * gradientAtPoint(curve, location)
 *
 * 	Calculates the gradient to the curve at the given location, as a decimal between 0 and 1 inclusive.
 *
 * gradientAtPointAlongCurveFrom (curve, location)
 *
 *	Calculates the gradient at the point on the given curve that is 'distance' units from location.
 *
 * nearestPointOnCurve(point, curve)
 *
 *	Calculates the nearest point to the given point on the given curve.  The return value of this is a JS object literal, containing both the
 *point's coordinates and also the 'location' of the point (see above), for example:  { point:{x:551,y:150}, location:0.263365 }.
 *
 * pointOnCurve(curve, location)
 *
 * 	Calculates the coordinates of the point on the given Bezier curve at the given location.
 *
 * pointAlongCurveFrom(curve, location, distance)
 *
 * 	Calculates the coordinates of the point on the given curve that is 'distance' units from location.  'distance' should be in the same coordinate
 * space as that used to construct the Bezier curve.  For an HTML Canvas usage, for example, distance would be a measure of pixels.
 *
 * locationAlongCurveFrom(curve, location, distance)
 *
 * 	Calculates the location on the given curve that is 'distance' units from location.  'distance' should be in the same coordinate
 * space as that used to construct the Bezier curve.  For an HTML Canvas usage, for example, distance would be a measure of pixels.
 *
 * perpendicularToCurveAt(curve, location, length, distance)
 *
 * 	Calculates the perpendicular to the given curve at the given location.  length is the length of the line you wish for (it will be centered
 * on the point at 'location'). distance is optional, and allows you to specify a point along the path from the given location as the center of
 * the perpendicular returned.  The return value of this is an array of two points: [ {x:...,y:...}, {x:...,y:...} ].
 *
 *
 */

(function() {

    var root = this;

    if(typeof Math.sgn == "undefined") {
        Math.sgn = function(x) { return x == 0 ? 0 : x > 0 ? 1 :-1; };
    }

    var Vectors = {
            subtract 	: 	function(v1, v2) { return {x:v1.x - v2.x, y:v1.y - v2.y }; },
            dotProduct	: 	function(v1, v2) { return (v1.x * v2.x)  + (v1.y * v2.y); },
            square		:	function(v) { return Math.sqrt((v.x * v.x) + (v.y * v.y)); },
            scale		:	function(v, s) { return {x:v.x * s, y:v.y * s }; }
        },

        maxRecursion = 64,
        flatnessTolerance = Math.pow(2.0,-maxRecursion-1);

    /**
     * Calculates the distance that the point lies from the curve.
     *
     * @param point a point in the form {x:567, y:3342}
     * @param curve a Bezier curve in the form [{x:..., y:...}, {x:..., y:...}, {x:..., y:...}, {x:..., y:...}].  note that this is currently
     * hardcoded to assume cubiz beziers, but would be better off supporting any degree.
     * @return a JS object literal containing location and distance, for example: {location:0.35, distance:10}.  Location is analogous to the location
     * argument you pass to the pointOnPath function: it is a ratio of distance travelled along the curve.  Distance is the distance in pixels from
     * the point to the curve.
     */
    var _distanceFromCurve = function(point, curve) {
        var candidates = [],
            w = _convertToBezier(point, curve),
            degree = curve.length - 1, higherDegree = (2 * degree) - 1,
            numSolutions = _findRoots(w, higherDegree, candidates, 0),
            v = Vectors.subtract(point, curve[0]), dist = Vectors.square(v), t = 0.0;

        for (var i = 0; i < numSolutions; i++) {
            v = Vectors.subtract(point, _bezier(curve, degree, candidates[i], null, null));
            var newDist = Vectors.square(v);
            if (newDist < dist) {
                dist = newDist;
                t = candidates[i];
            }
        }
        v = Vectors.subtract(point, curve[degree]);
        newDist = Vectors.square(v);
        if (newDist < dist) {
            dist = newDist;
            t = 1.0;
        }
        return {location:t, distance:dist};
    };
    /**
     * finds the nearest point on the curve to the given point.
     */
    var _nearestPointOnCurve = function(point, curve) {
        var td = _distanceFromCurve(point, curve);
        return {point:_bezier(curve, curve.length - 1, td.location, null, null), location:td.location};
    };
    var _convertToBezier = function(point, curve) {
        var degree = curve.length - 1, higherDegree = (2 * degree) - 1,
            c = [], d = [], cdTable = [], w = [],
            z = [ [1.0, 0.6, 0.3, 0.1], [0.4, 0.6, 0.6, 0.4], [0.1, 0.3, 0.6, 1.0] ];

        for (var i = 0; i <= degree; i++) c[i] = Vectors.subtract(curve[i], point);
        for (var i = 0; i <= degree - 1; i++) {
            d[i] = Vectors.subtract(curve[i+1], curve[i]);
            d[i] = Vectors.scale(d[i], 3.0);
        }
        for (var row = 0; row <= degree - 1; row++) {
            for (var column = 0; column <= degree; column++) {
                if (!cdTable[row]) cdTable[row] = [];
                cdTable[row][column] = Vectors.dotProduct(d[row], c[column]);
            }
        }
        for (i = 0; i <= higherDegree; i++) {
            if (!w[i]) w[i] = [];
            w[i].y = 0.0;
            w[i].x = parseFloat(i) / higherDegree;
        }
        var n = degree, m = degree-1;
        for (var k = 0; k <= n + m; k++) {
            var lb = Math.max(0, k - m),
                ub = Math.min(k, n);
            for (i = lb; i <= ub; i++) {
                var j = k - i;
                w[i+j].y += cdTable[j][i] * z[j][i];
            }
        }
        return w;
    };
    /**
     * counts how many roots there are.
     */
    var _findRoots = function(w, degree, t, depth) {
        var left = [], right = [],
            left_count, right_count,
            left_t = [], right_t = [];

        switch (_getCrossingCount(w, degree)) {
            case 0 : {
                return 0;
            }
            case 1 : {
                if (depth >= maxRecursion) {
                    t[0] = (w[0].x + w[degree].x) / 2.0;
                    return 1;
                }
                if (_isFlatEnough(w, degree)) {
                    t[0] = _computeXIntercept(w, degree);
                    return 1;
                }
                break;
            }
        }
        _bezier(w, degree, 0.5, left, right);
        left_count  = _findRoots(left,  degree, left_t, depth+1);
        right_count = _findRoots(right, degree, right_t, depth+1);
        for (var i = 0; i < left_count; i++) t[i] = left_t[i];
        for (var i = 0; i < right_count; i++) t[i+left_count] = right_t[i];
        return (left_count+right_count);
    };
    var _getCrossingCount = function(curve, degree) {
        var n_crossings = 0, sign, old_sign;
        sign = old_sign = Math.sgn(curve[0].y);
        for (var i = 1; i <= degree; i++) {
            sign = Math.sgn(curve[i].y);
            if (sign != old_sign) n_crossings++;
            old_sign = sign;
        }
        return n_crossings;
    };
    var _isFlatEnough = function(curve, degree) {
        var  error,
            intercept_1, intercept_2, left_intercept, right_intercept,
            a, b, c, det, dInv, a1, b1, c1, a2, b2, c2;
        a = curve[0].y - curve[degree].y;
        b = curve[degree].x - curve[0].x;
        c = curve[0].x * curve[degree].y - curve[degree].x * curve[0].y;

        var max_distance_above, max_distance_below;
        max_distance_above = max_distance_below = 0.0;

        for (var i = 1; i < degree; i++) {
            var value = a * curve[i].x + b * curve[i].y + c;
            if (value > max_distance_above)
                max_distance_above = value;
            else if (value < max_distance_below)
                max_distance_below = value;
        }

        a1 = 0.0; b1 = 1.0; c1 = 0.0; a2 = a; b2 = b;
        c2 = c - max_distance_above;
        det = a1 * b2 - a2 * b1;
        dInv = 1.0/det;
        intercept_1 = (b1 * c2 - b2 * c1) * dInv;
        a2 = a; b2 = b; c2 = c - max_distance_below;
        det = a1 * b2 - a2 * b1;
        dInv = 1.0/det;
        intercept_2 = (b1 * c2 - b2 * c1) * dInv;
        left_intercept = Math.min(intercept_1, intercept_2);
        right_intercept = Math.max(intercept_1, intercept_2);
        error = right_intercept - left_intercept;
        return (error < flatnessTolerance)? 1 : 0;
    };
    var _computeXIntercept = function(curve, degree) {
        var XLK = 1.0, YLK = 0.0,
            XNM = curve[degree].x - curve[0].x, YNM = curve[degree].y - curve[0].y,
            XMK = curve[0].x - 0.0, YMK = curve[0].y - 0.0,
            det = XNM*YLK - YNM*XLK, detInv = 1.0/det,
            S = (XNM*YMK - YNM*XMK) * detInv;
        return 0.0 + XLK * S;
    };
    var _bezier = function(curve, degree, t, left, right) {
        var temp = [[]];
        for (var j =0; j <= degree; j++) temp[0][j] = curve[j];
        for (var i = 1; i <= degree; i++) {
            for (var j =0 ; j <= degree - i; j++) {
                if (!temp[i]) temp[i] = [];
                if (!temp[i][j]) temp[i][j] = {};
                temp[i][j].x = (1.0 - t) * temp[i-1][j].x + t * temp[i-1][j+1].x;
                temp[i][j].y = (1.0 - t) * temp[i-1][j].y + t * temp[i-1][j+1].y;
            }
        }
        if (left != null)
            for (j = 0; j <= degree; j++) left[j]  = temp[j][0];
        if (right != null)
            for (j = 0; j <= degree; j++) right[j] = temp[degree-j][j];

        return (temp[degree][0]);
    };

    var _curveFunctionCache = {};
    var _getCurveFunctions = function(order) {
        var fns = _curveFunctionCache[order];
        if (!fns) {
            fns = [];
            var f_term = function() { return function(t) { return Math.pow(t, order); }; },
                l_term = function() { return function(t) { return Math.pow((1-t), order); }; },
                c_term = function(c) { return function(t) { return c; }; },
                t_term = function() { return function(t) { return t; }; },
                one_minus_t_term = function() { return function(t) { return 1-t; }; },
                _termFunc = function(terms) {
                    return function(t) {
                        var p = 1;
                        for (var i = 0; i < terms.length; i++) p = p * terms[i](t);
                        return p;
                    };
                };

            fns.push(new f_term());  // first is t to the power of the curve order
            for (var i = 1; i < order; i++) {
                var terms = [new c_term(order)];
                for (var j = 0 ; j < (order - i); j++) terms.push(new t_term());
                for (var j = 0 ; j < i; j++) terms.push(new one_minus_t_term());
                fns.push(new _termFunc(terms));
            }
            fns.push(new l_term());  // last is (1-t) to the power of the curve order

            _curveFunctionCache[order] = fns;
        }

        return fns;
    };


    /**
     * calculates a point on the curve, for a Bezier of arbitrary order.
     * @param curve an array of control points, eg [{x:10,y:20}, {x:50,y:50}, {x:100,y:100}, {x:120,y:100}].  For a cubic bezier this should have four points.
     * @param location a decimal indicating the distance along the curve the point should be located at.  this is the distance along the curve as it travels, taking the way it bends into account.  should be a number from 0 to 1, inclusive.
     */
    var _pointOnPath = function(curve, location) {
        var cc = _getCurveFunctions(curve.length - 1),
            _x = 0, _y = 0;
        for (var i = 0; i < curve.length ; i++) {
            _x = _x + (curve[i].x * cc[i](location));
            _y = _y + (curve[i].y * cc[i](location));
        }

        return {x:_x, y:_y};
    };

    var _dist = function(p1,p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    var _isPoint = function(curve) {
        return curve[0].x === curve[1].x && curve[0].y === curve[1].y;
    };

    /**
     * finds the point that is 'distance' along the path from 'location'.  this method returns both the x,y location of the point and also
     * its 'location' (proportion of travel along the path); the method below - _pointAlongPathFrom - calls this method and just returns the
     * point.
     */
    var _pointAlongPath = function(curve, location, distance) {

        if (_isPoint(curve)) {
            return {
                point:curve[0],
                location:location
            };
        }

        var prev = _pointOnPath(curve, location),
            tally = 0,
            curLoc = location,
            direction = distance > 0 ? 1 : -1,
            cur = null;

        while (tally < Math.abs(distance)) {
            curLoc += (0.005 * direction);
            cur = _pointOnPath(curve, curLoc);
            tally += _dist(cur, prev);
            prev = cur;
        }
        return {point:cur, location:curLoc};
    };

    var _length = function(curve) {
        if (_isPoint(curve)) return 0;

        var prev = _pointOnPath(curve, 0),
            tally = 0,
            curLoc = 0,
            direction = 1,
            cur = null;

        while (curLoc < 1) {
            curLoc += (0.005 * direction);
            cur = _pointOnPath(curve, curLoc);
            tally += _dist(cur, prev);
            prev = cur;
        }
        return tally;
    };

    /**
     * finds the point that is 'distance' along the path from 'location'.
     */
    var _pointAlongPathFrom = function(curve, location, distance) {
        return _pointAlongPath(curve, location, distance).point;
    };

    /**
     * finds the location that is 'distance' along the path from 'location'.
     */
    var _locationAlongPathFrom = function(curve, location, distance) {
        return _pointAlongPath(curve, location, distance).location;
    };

    /**
     * returns the gradient of the curve at the given location, which is a decimal between 0 and 1 inclusive.
     *
     * thanks // http://bimixual.org/AnimationLibrary/beziertangents.html
     */
    var _gradientAtPoint = function(curve, location) {
        var p1 = _pointOnPath(curve, location),
            p2 = _pointOnPath(curve.slice(0, curve.length - 1), location),
            dy = p2.y - p1.y, dx = p2.x - p1.x;
        return dy === 0 ? Infinity : Math.atan(dy / dx);
    };

    /**
     returns the gradient of the curve at the point which is 'distance' from the given location.
     if this point is greater than location 1, the gradient at location 1 is returned.
     if this point is less than location 0, the gradient at location 0 is returned.
     */
    var _gradientAtPointAlongPathFrom = function(curve, location, distance) {
        var p = _pointAlongPath(curve, location, distance);
        if (p.location > 1) p.location = 1;
        if (p.location < 0) p.location = 0;
        return _gradientAtPoint(curve, p.location);
    };

    /**
     * calculates a line that is 'length' pixels long, perpendicular to, and centered on, the path at 'distance' pixels from the given location.
     * if distance is not supplied, the perpendicular for the given location is computed (ie. we set distance to zero).
     */
    var _perpendicularToPathAt = function(curve, location, length, distance) {
        distance = distance == null ? 0 : distance;
        var p = _pointAlongPath(curve, location, distance),
            m = _gradientAtPoint(curve, p.location),
            _theta2 = Math.atan(-1 / m),
            y =  length / 2 * Math.sin(_theta2),
            x =  length / 2 * Math.cos(_theta2);
        return [{x:p.point.x + x, y:p.point.y + y}, {x:p.point.x - x, y:p.point.y - y}];
    };

    /**
     * Calculates all intersections of the given line with the given curve.
     * @param x1
     * @param y1
     * @param x2
     * @param y2
     * @param curve
     * @returns {Array}
     */
    var _lineIntersection = function(x1, y1, x2, y2, curve) {
        var a = y2 - y1,
            b = x1 - x2,
            c = (x1 * (y1 - y2)) + (y1 * (x2-x1)),
            coeffs = _computeCoefficients(curve),
            p = [
                (a*coeffs[0][0]) + (b * coeffs[1][0]),
                (a*coeffs[0][1])+(b*coeffs[1][1]),
                (a*coeffs[0][2])+(b*coeffs[1][2]),
                (a*coeffs[0][3])+(b*coeffs[1][3]) + c
            ],
            r = _cubicRoots.apply(null, p),
            intersections = [];

        if (r != null) {

            for (var i = 0; i < 3; i++) {
                var t = r[i],
                    t2 = Math.pow(t, 2),
                    t3 = Math.pow(t, 3),
                    x = [
                        (coeffs[0][0] * t3) + (coeffs[0][1] * t2) + (coeffs[0][2] * t) + coeffs[0][3],
                        (coeffs[1][0] * t3) + (coeffs[1][1] * t2) + (coeffs[1][2] * t) + coeffs[1][3]
                    ];

                // check bounds of the line
                var s;
                if ((x2 - x1) !== 0) {
                    s = (x[0] - x1) / (x2 - x1);
                }
                else {
                    s = (x[1] - y1) / (y2 - y1);
                }

                if (t >= 0 && t <= 1.0 && s >= 0 && s <= 1.0) {
                    intersections.push(x);
                }
            }
        }

        return intersections;
    };

    /**
     * Calculates all intersections of the given box with the given curve.
     * @param x X position of top left corner of box
     * @param y Y position of top left corner of box
     * @param w width of box
     * @param h height of box
     * @param curve
     * @returns {Array}
     */
    var _boxIntersection = function(x, y, w, h, curve) {
        var i = [];
        i.push.apply(i, _lineIntersection(x, y, x + w, y, curve));
        i.push.apply(i, _lineIntersection(x + w, y, x + w, y + h, curve));
        i.push.apply(i, _lineIntersection(x + w, y + h, x, y + h, curve));
        i.push.apply(i, _lineIntersection(x, y + h, x, y, curve));
        return i;
    };

    /**
     * Calculates all intersections of the given bounding box with the given curve.
     * @param boundingBox Bounding box, in { x:.., y:..., w:..., h:... } format.
     * @param curve
     * @returns {Array}
     */
    var _boundingBoxIntersection = function(boundingBox, curve) {
        var i = [];
        i.push.apply(i, _lineIntersection(boundingBox.x, boundingBox.y, boundingBox.x + boundingBox.w, boundingBox.y, curve));
        i.push.apply(i, _lineIntersection(boundingBox.x + boundingBox.w, boundingBox.y, boundingBox.x + boundingBox.w, boundingBox.y + boundingBox.h, curve));
        i.push.apply(i, _lineIntersection(boundingBox.x + boundingBox.w, boundingBox.y + boundingBox.h, boundingBox.x, boundingBox.y + boundingBox.h, curve));
        i.push.apply(i, _lineIntersection(boundingBox.x, boundingBox.y + boundingBox.h, boundingBox.x, boundingBox.y, curve));
        return i;
    };


    function _computeCoefficientsForAxis(curve, axis) {
        return [
            -(curve[0][axis]) + (3*curve[1][axis]) + (-3 * curve[2][axis]) + curve[3][axis],
            (3*(curve[0][axis])) - (6*(curve[1][axis])) + (3*(curve[2][axis])),
            -3*curve[0][axis] + 3*curve[1][axis],
            curve[0][axis]
        ];
    }

    function _computeCoefficients(curve)
    {
        return [
            _computeCoefficientsForAxis(curve, "x"),
            _computeCoefficientsForAxis(curve, "y")
        ];
    }

    function sgn(x) {
        return x < 0 ? -1 : x > 0 ? 1 : 0;
    }

    function _cubicRoots(a, b, c, d) {
        var A = b / a,
            B = c / a,
            C = d / a,
            Q = (3*B - Math.pow(A, 2))/9,
            R = (9*A*B - 27*C - 2*Math.pow(A, 3))/54,
            D = Math.pow(Q, 3) + Math.pow(R, 2),
            S,
            T,
            t = [];

        if (D >= 0)                                 // complex or duplicate roots
        {
            S = sgn(R + Math.sqrt(D))*Math.pow(Math.abs(R + Math.sqrt(D)),(1/3));
            T = sgn(R - Math.sqrt(D))*Math.pow(Math.abs(R - Math.sqrt(D)),(1/3));

            t[0] = -A/3 + (S + T);
            t[1] = -A/3 - (S + T)/2;
            t[2] = -A/3 - (S + T)/2;

            /*discard complex roots*/
            if (Math.abs(Math.sqrt(3)*(S - T)/2) !== 0) {
                t[1] = -1;
                t[2] = -1;
            }
        }
        else                                          // distinct real roots
        {
            var th = Math.acos(R/Math.sqrt(-Math.pow(Q, 3)));
            t[0] = 2*Math.sqrt(-Q)*Math.cos(th/3) - A/3;
            t[1] = 2*Math.sqrt(-Q)*Math.cos((th + 2*Math.PI)/3) - A/3;
            t[2] = 2*Math.sqrt(-Q)*Math.cos((th + 4*Math.PI)/3) - A/3;
        }

        // discard out of spec roots
        for (var i = 0; i < 3; i++) {
            if (t[i] < 0 || t[i] > 1.0) {
                t[i] = -1;
            }
        }

        return t;
    }

    var jsBezier = this.jsBezier = {
        distanceFromCurve : _distanceFromCurve,
        gradientAtPoint : _gradientAtPoint,
        gradientAtPointAlongCurveFrom : _gradientAtPointAlongPathFrom,
        nearestPointOnCurve : _nearestPointOnCurve,
        pointOnCurve : _pointOnPath,
        pointAlongCurveFrom : _pointAlongPathFrom,
        perpendicularToCurveAt : _perpendicularToPathAt,
        locationAlongCurveFrom:_locationAlongPathFrom,
        getLength:_length,
        lineIntersection:_lineIntersection,
        boxIntersection:_boxIntersection,
        boundingBoxIntersection:_boundingBoxIntersection,
        version:"0.9.0"
    };

    if (typeof exports !== "undefined") {
        exports.jsBezier = jsBezier;
    }

}).call(typeof window !== 'undefined' ? window : this);

/**
 * Biltong v0.4.0
 *
 * Various geometry functions written as part of jsPlumb and perhaps useful for others.
 *
 * Copyright (c) 2017 jsPlumb
 * https://jsplumbtoolkit.com
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
;(function() {

    "use strict";
    var root = this;

    var Biltong = root.Biltong = {
        version:"0.4.0"
    };

    if (typeof exports !== "undefined") {
        exports.Biltong = Biltong;
    }

    var _isa = function(a) { return Object.prototype.toString.call(a) === "[object Array]"; },
        _pointHelper = function(p1, p2, fn) {
            p1 = _isa(p1) ? p1 : [p1.x, p1.y];
            p2 = _isa(p2) ? p2 : [p2.x, p2.y];
            return fn(p1, p2);
        },
        /**
         * @name Biltong.gradient
         * @function
         * @desc Calculates the gradient of a line between the two points.
         * @param {Point} p1 First point, either as a 2 entry array or object with `left` and `top` properties.
         * @param {Point} p2 Second point, either as a 2 entry array or object with `left` and `top` properties.
         * @return {Float} The gradient of a line between the two points.
         */
        _gradient = Biltong.gradient = function(p1, p2) {
            return _pointHelper(p1, p2, function(_p1, _p2) {
                if (_p2[0] == _p1[0])
                    return _p2[1] > _p1[1] ? Infinity : -Infinity;
                else if (_p2[1] == _p1[1])
                    return _p2[0] > _p1[0] ? 0 : -0;
                else
                    return (_p2[1] - _p1[1]) / (_p2[0] - _p1[0]);
            });
        },
        /**
         * @name Biltong.normal
         * @function
         * @desc Calculates the gradient of a normal to a line between the two points.
         * @param {Point} p1 First point, either as a 2 entry array or object with `left` and `top` properties.
         * @param {Point} p2 Second point, either as a 2 entry array or object with `left` and `top` properties.
         * @return {Float} The gradient of a normal to a line between the two points.
         */
        _normal = Biltong.normal = function(p1, p2) {
            return -1 / _gradient(p1, p2);
        },
        /**
         * @name Biltong.lineLength
         * @function
         * @desc Calculates the length of a line between the two points.
         * @param {Point} p1 First point, either as a 2 entry array or object with `left` and `top` properties.
         * @param {Point} p2 Second point, either as a 2 entry array or object with `left` and `top` properties.
         * @return {Float} The length of a line between the two points.
         */
        _lineLength = Biltong.lineLength = function(p1, p2) {
            return _pointHelper(p1, p2, function(_p1, _p2) {
                return Math.sqrt(Math.pow(_p2[1] - _p1[1], 2) + Math.pow(_p2[0] - _p1[0], 2));
            });
        },
        /**
         * @name Biltong.quadrant
         * @function
         * @desc Calculates the quadrant in which the angle between the two points lies.
         * @param {Point} p1 First point, either as a 2 entry array or object with `left` and `top` properties.
         * @param {Point} p2 Second point, either as a 2 entry array or object with `left` and `top` properties.
         * @return {Integer} The quadrant - 1 for upper right, 2 for lower right, 3 for lower left, 4 for upper left.
         */
        _quadrant = Biltong.quadrant = function(p1, p2) {
            return _pointHelper(p1, p2, function(_p1, _p2) {
                if (_p2[0] > _p1[0]) {
                    return (_p2[1] > _p1[1]) ? 2 : 1;
                }
                else if (_p2[0] == _p1[0]) {
                    return _p2[1] > _p1[1] ? 2 : 1;
                }
                else {
                    return (_p2[1] > _p1[1]) ? 3 : 4;
                }
            });
        },
        /**
         * @name Biltong.theta
         * @function
         * @desc Calculates the angle between the two points.
         * @param {Point} p1 First point, either as a 2 entry array or object with `left` and `top` properties.
         * @param {Point} p2 Second point, either as a 2 entry array or object with `left` and `top` properties.
         * @return {Float} The angle between the two points.
         */
        _theta = Biltong.theta = function(p1, p2) {
            return _pointHelper(p1, p2, function(_p1, _p2) {
                var m = _gradient(_p1, _p2),
                    t = Math.atan(m),
                    s = _quadrant(_p1, _p2);
                if ((s == 4 || s== 3)) t += Math.PI;
                if (t < 0) t += (2 * Math.PI);

                return t;
            });
        },
        /**
         * @name Biltong.intersects
         * @function
         * @desc Calculates whether or not the two rectangles intersect.
         * @param {Rectangle} r1 First rectangle, as a js object in the form `{x:.., y:.., w:.., h:..}`
         * @param {Rectangle} r2 Second rectangle, as a js object in the form `{x:.., y:.., w:.., h:..}`
         * @return {Boolean} True if the rectangles intersect, false otherwise.
         */
        _intersects = Biltong.intersects = function(r1, r2) {
            var x1 = r1.x, x2 = r1.x + r1.w, y1 = r1.y, y2 = r1.y + r1.h,
                a1 = r2.x, a2 = r2.x + r2.w, b1 = r2.y, b2 = r2.y + r2.h;

            return  ( (x1 <= a1 && a1 <= x2) && (y1 <= b1 && b1 <= y2) ) ||
                ( (x1 <= a2 && a2 <= x2) && (y1 <= b1 && b1 <= y2) ) ||
                ( (x1 <= a1 && a1 <= x2) && (y1 <= b2 && b2 <= y2) ) ||
                ( (x1 <= a2 && a1 <= x2) && (y1 <= b2 && b2 <= y2) ) ||
                ( (a1 <= x1 && x1 <= a2) && (b1 <= y1 && y1 <= b2) ) ||
                ( (a1 <= x2 && x2 <= a2) && (b1 <= y1 && y1 <= b2) ) ||
                ( (a1 <= x1 && x1 <= a2) && (b1 <= y2 && y2 <= b2) ) ||
                ( (a1 <= x2 && x1 <= a2) && (b1 <= y2 && y2 <= b2) );
        },
        /**
         * @name Biltong.encloses
         * @function
         * @desc Calculates whether or not r2 is completely enclosed by r1.
         * @param {Rectangle} r1 First rectangle, as a js object in the form `{x:.., y:.., w:.., h:..}`
         * @param {Rectangle} r2 Second rectangle, as a js object in the form `{x:.., y:.., w:.., h:..}`
         * @param {Boolean} [allowSharedEdges=false] If true, the concept of enclosure allows for one or more edges to be shared by the two rectangles.
         * @return {Boolean} True if r1 encloses r2, false otherwise.
         */
        _encloses = Biltong.encloses = function(r1, r2, allowSharedEdges) {
            var x1 = r1.x, x2 = r1.x + r1.w, y1 = r1.y, y2 = r1.y + r1.h,
                a1 = r2.x, a2 = r2.x + r2.w, b1 = r2.y, b2 = r2.y + r2.h,
                c = function(v1, v2, v3, v4) { return allowSharedEdges ? v1 <= v2 && v3>= v4 : v1 < v2 && v3 > v4; };

            return c(x1,a1,x2,a2) && c(y1,b1,y2,b2);
        },
        _segmentMultipliers = [null, [1, -1], [1, 1], [-1, 1], [-1, -1] ],
        _inverseSegmentMultipliers = [null, [-1, -1], [-1, 1], [1, 1], [1, -1] ],
        /**
         * @name Biltong.pointOnLine
         * @function
         * @desc Calculates a point on the line from `fromPoint` to `toPoint` that is `distance` units along the length of the line.
         * @param {Point} p1 First point, either as a 2 entry array or object with `left` and `top` properties.
         * @param {Point} p2 Second point, either as a 2 entry array or object with `left` and `top` properties.
         * @return {Point} Point on the line, in the form `{ x:..., y:... }`.
         */
        _pointOnLine = Biltong.pointOnLine = function(fromPoint, toPoint, distance) {
            var m = _gradient(fromPoint, toPoint),
                s = _quadrant(fromPoint, toPoint),
                segmentMultiplier = distance > 0 ? _segmentMultipliers[s] : _inverseSegmentMultipliers[s],
                theta = Math.atan(m),
                y = Math.abs(distance * Math.sin(theta)) * segmentMultiplier[1],
                x =  Math.abs(distance * Math.cos(theta)) * segmentMultiplier[0];
            return { x:fromPoint.x + x, y:fromPoint.y + y };
        },
        /**
         * @name Biltong.perpendicularLineTo
         * @function
         * @desc Calculates a line of length `length` that is perpendicular to the line from `fromPoint` to `toPoint` and passes through `toPoint`.
         * @param {Point} p1 First point, either as a 2 entry array or object with `left` and `top` properties.
         * @param {Point} p2 Second point, either as a 2 entry array or object with `left` and `top` properties.
         * @return {Line} Perpendicular line, in the form `[ { x:..., y:... }, { x:..., y:... } ]`.
         */
        _perpendicularLineTo = Biltong.perpendicularLineTo = function(fromPoint, toPoint, length) {
            var m = _gradient(fromPoint, toPoint),
                theta2 = Math.atan(-1 / m),
                y =  length / 2 * Math.sin(theta2),
                x =  length / 2 * Math.cos(theta2);
            return [{x:toPoint.x + x, y:toPoint.y + y}, {x:toPoint.x - x, y:toPoint.y - y}];
        };
}).call(typeof window !== 'undefined' ? window : this);
;
(function () {

    "use strict";

    /**
     * Creates a Touch object.
     * @param view
     * @param target
     * @param pageX
     * @param pageY
     * @param screenX
     * @param screenY
     * @param clientX
     * @param clientY
     * @returns {Touch}
     * @private
     */
    function _touch(view, target, pageX, pageY, screenX, screenY, clientX, clientY) {

            return new Touch({
                target:target,
                identifier:_uuid(),
                pageX: pageX,
                pageY: pageY,
                screenX: screenX,
                screenY: screenY,
                clientX: clientX || screenX,
                clientY: clientY || screenY
            });
    }

    /**
     * Create a synthetic touch list from the given list of Touch objects.
     * @returns {Array}
     * @private
     */
    function _touchList() {
        var list = [];
        Array.prototype.push.apply(list, arguments);
        list.item =  function(index) { return this[index]; };
        return list;
    }

    /**
     * Create a Touch object and then insert it into a synthetic touch list, returning the list.s
     * @param view
     * @param target
     * @param pageX
     * @param pageY
     * @param screenX
     * @param screenY
     * @param clientX
     * @param clientY
     * @returns {Array}
     * @private
     */
    function _touchAndList(view, target, pageX, pageY, screenX, screenY, clientX, clientY) {
        return _touchList(_touch.apply(null, arguments));
    }

    var root = this,
        matchesSelector = function (el, selector, ctx) {
            ctx = ctx || el.parentNode;
            var possibles = ctx.querySelectorAll(selector);
            for (var i = 0; i < possibles.length; i++) {
                if (possibles[i] === el) {
                    return true;
                }
            }
            return false;
        },
        _gel = function (el) {
            return (typeof el == "string" || el.constructor === String) ? document.getElementById(el) : el;
        },
        _t = function (e) {
            return e.srcElement || e.target;
        },
    //
    // gets path info for the given event - the path from target to obj, in the event's bubble chain. if doCompute
    // is false we just return target for the path.
    //
        _pi = function(e, target, obj, doCompute) {
            if (!doCompute) return { path:[target], end:1 };
            else if (typeof e.path !== "undefined" && e.path.indexOf) {
                return { path: e.path, end: e.path.indexOf(obj) };
            } else {
                var out = { path:[], end:-1 }, _one = function(el) {
                    out.path.push(el);
                    if (el === obj) {
                        out.end = out.path.length - 1;
                    }
                    else if (el.parentNode != null) {
                        _one(el.parentNode)
                    }
                };
                _one(target);
                return out;
            }
        },
        _d = function (l, fn) {
            for (var i = 0, j = l.length; i < j; i++) {
                if (l[i] == fn) break;
            }
            if (i < l.length) l.splice(i, 1);
        },
        guid = 1,
    //
    // this function generates a guid for every handler, sets it on the handler, then adds
    // it to the associated object's map of handlers for the given event. this is what enables us
    // to unbind all events of some type, or all events (the second of which can be requested by the user,
    // but it also used by Mottle when an element is removed.)
        _store = function (obj, event, fn) {
            var g = guid++;
            obj.__ta = obj.__ta || {};
            obj.__ta[event] = obj.__ta[event] || {};
            // store each handler with a unique guid.
            obj.__ta[event][g] = fn;
            // set the guid on the handler.
            fn.__tauid = g;
            return g;
        },
        _unstore = function (obj, event, fn) {
            obj.__ta && obj.__ta[event] && delete obj.__ta[event][fn.__tauid];
            // a handler might have attached extra functions, so we unbind those too.
            if (fn.__taExtra) {
                for (var i = 0; i < fn.__taExtra.length; i++) {
                    _unbind(obj, fn.__taExtra[i][0], fn.__taExtra[i][1]);
                }
                fn.__taExtra.length = 0;
            }
            // a handler might have attached an unstore callback
            fn.__taUnstore && fn.__taUnstore();
        },
        _curryChildFilter = function (children, obj, fn, evt) {
            if (children == null) return fn;
            else {
                var c = children.split(","),
                    _fn = function (e) {
                        _fn.__tauid = fn.__tauid;
                        var t = _t(e), target = t;  // t is the target element on which the event occurred. it is the
                        // element we will wish to pass to any callbacks.
                        var pathInfo = _pi(e, t, obj, children != null)
                        if (pathInfo.end != -1) {
                            for (var p = 0; p < pathInfo.end; p++) {
                                target = pathInfo.path[p];
                                for (var i = 0; i < c.length; i++) {
                                    if (matchesSelector(target, c[i], obj)) {
                                        fn.apply(target, arguments);
                                    }
                                }
                            }
                        }
                    };
                registerExtraFunction(fn, evt, _fn);
                return _fn;
            }
        },
    //
    // registers an 'extra' function on some event listener function we were given - a function that we
    // created and bound to the element as part of our housekeeping, and which we want to unbind and remove
    // whenever the given function is unbound.
        registerExtraFunction = function (fn, evt, newFn) {
            fn.__taExtra = fn.__taExtra || [];
            fn.__taExtra.push([evt, newFn]);
        },
        DefaultHandler = function (obj, evt, fn, children) {
            if (isTouchDevice && touchMap[evt]) {
                var tfn = _curryChildFilter(children, obj, fn, touchMap[evt]);
                _bind(obj, touchMap[evt], tfn , fn);
            }
            if (evt === "focus" && obj.getAttribute("tabindex") == null) {
                obj.setAttribute("tabindex", "1");
            }
            _bind(obj, evt, _curryChildFilter(children, obj, fn, evt), fn);
        },
        SmartClickHandler = function (obj, evt, fn, children) {
            if (obj.__taSmartClicks == null) {
                var down = function (e) {
                        obj.__tad = _pageLocation(e);
                    },
                    up = function (e) {
                        obj.__tau = _pageLocation(e);
                    },
                    click = function (e) {
                        if (obj.__tad && obj.__tau && obj.__tad[0] === obj.__tau[0] && obj.__tad[1] === obj.__tau[1]) {
                            for (var i = 0; i < obj.__taSmartClicks.length; i++)
                                obj.__taSmartClicks[i].apply(_t(e), [ e ]);
                        }
                    };
                DefaultHandler(obj, "mousedown", down, children);
                DefaultHandler(obj, "mouseup", up, children);
                DefaultHandler(obj, "click", click, children);
                obj.__taSmartClicks = [];
            }

            // store in the list of callbacks
            obj.__taSmartClicks.push(fn);
            // the unstore function removes this function from the object's listener list for this type.
            fn.__taUnstore = function () {
                _d(obj.__taSmartClicks, fn);
            };
        },
        _tapProfiles = {
            "tap": {touches: 1, taps: 1},
            "dbltap": {touches: 1, taps: 2},
            "contextmenu": {touches: 2, taps: 1}
        },
        TapHandler = function (clickThreshold, dblClickThreshold) {
            return function (obj, evt, fn, children) {
                // if event is contextmenu, for devices which are mouse only, we want to
                // use the default bind.
                if (evt == "contextmenu" && isMouseDevice)
                    DefaultHandler(obj, evt, fn, children);
                else {
                    // the issue here is that this down handler gets registered only for the
                    // child nodes in the first registration. in fact it should be registered with
                    // no child selector and then on down we should cycle through the registered
                    // functions to see if one of them matches. on mouseup we should execute ALL of
                    // the functions whose children are either null or match the element.
                    if (obj.__taTapHandler == null) {
                        var tt = obj.__taTapHandler = {
                            tap: [],
                            dbltap: [],
                            contextmenu: [],
                            down: false,
                            taps: 0,
                            downSelectors: []
                        };
                        var down = function (e) {
                                var target = _t(e), pathInfo = _pi(e, target, obj, children != null), finished = false;
                                for (var p = 0; p < pathInfo.end; p++) {
                                    if (finished) return;
                                    target = pathInfo.path[p];
                                    for (var i = 0; i < tt.downSelectors.length; i++) {
                                        if (tt.downSelectors[i] == null || matchesSelector(target, tt.downSelectors[i], obj)) {
                                            tt.down = true;
                                            setTimeout(clearSingle, clickThreshold);
                                            setTimeout(clearDouble, dblClickThreshold);
                                            finished = true;
                                            break; // we only need one match on mousedown
                                        }
                                    }
                                }
                            },
                            up = function (e) {
                                if (tt.down) {
                                    var target = _t(e), currentTarget, pathInfo;
                                    tt.taps++;
                                    var tc = _touchCount(e);
                                    for (var eventId in _tapProfiles) {
                                        if (_tapProfiles.hasOwnProperty(eventId)) {
                                            var p = _tapProfiles[eventId];
                                            if (p.touches === tc && (p.taps === 1 || p.taps === tt.taps)) {
                                                for (var i = 0; i < tt[eventId].length; i++) {
                                                    pathInfo = _pi(e, target, obj, tt[eventId][i][1] != null);
                                                    for (var pLoop = 0; pLoop < pathInfo.end; pLoop++) {
                                                        currentTarget = pathInfo.path[pLoop];
                                                        // this is a single event registration handler.
                                                        if (tt[eventId][i][1] == null || matchesSelector(currentTarget, tt[eventId][i][1], obj)) {
                                                            tt[eventId][i][0].apply(currentTarget, [ e ]);
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            clearSingle = function () {
                                tt.down = false;
                            },
                            clearDouble = function () {
                                tt.taps = 0;
                            };

                        DefaultHandler(obj, "mousedown", down);
                        DefaultHandler(obj, "mouseup", up);
                    }
                    // add this child selector (it can be null, that's fine).
                    obj.__taTapHandler.downSelectors.push(children);

                    obj.__taTapHandler[evt].push([fn, children]);
                    // the unstore function removes this function from the object's listener list for this type.
                    fn.__taUnstore = function () {
                        _d(obj.__taTapHandler[evt], fn);
                    };
                }
            };
        },
        meeHelper = function (type, evt, obj, target) {
            for (var i in obj.__tamee[type]) {
                if (obj.__tamee[type].hasOwnProperty(i)) {
                    obj.__tamee[type][i].apply(target, [ evt ]);
                }
            }
        },
        MouseEnterExitHandler = function () {
            var activeElements = [];
            return function (obj, evt, fn, children) {
                if (!obj.__tamee) {
                    // __tamee holds a flag saying whether the mouse is currently "in" the element, and a list of
                    // both mouseenter and mouseexit functions.
                    obj.__tamee = { over: false, mouseenter: [], mouseexit: [] };
                    // register over and out functions
                    var over = function (e) {
                            var t = _t(e);
                            if ((children == null && (t == obj && !obj.__tamee.over)) || (matchesSelector(t, children, obj) && (t.__tamee == null || !t.__tamee.over))) {
                                meeHelper("mouseenter", e, obj, t);
                                t.__tamee = t.__tamee || {};
                                t.__tamee.over = true;
                                activeElements.push(t);
                            }
                        },
                        out = function (e) {
                            var t = _t(e);
                            // is the current target one of the activeElements? and is the
                            // related target NOT a descendant of it?
                            for (var i = 0; i < activeElements.length; i++) {
                                if (t == activeElements[i] && !matchesSelector((e.relatedTarget || e.toElement), "*", t)) {
                                    t.__tamee.over = false;
                                    activeElements.splice(i, 1);
                                    meeHelper("mouseexit", e, obj, t);
                                }
                            }
                        };

                    _bind(obj, "mouseover", _curryChildFilter(children, obj, over, "mouseover"), over);
                    _bind(obj, "mouseout", _curryChildFilter(children, obj, out, "mouseout"), out);
                }

                fn.__taUnstore = function () {
                    delete obj.__tamee[evt][fn.__tauid];
                };

                _store(obj, evt, fn);
                obj.__tamee[evt][fn.__tauid] = fn;
            };
        },
        isTouchDevice = "ontouchstart" in document.documentElement,
        isMouseDevice = "onmousedown" in document.documentElement,
        touchMap = { "mousedown": "touchstart", "mouseup": "touchend", "mousemove": "touchmove" },
        touchstart = "touchstart", touchend = "touchend", touchmove = "touchmove",
        iev = (function () {
            var rv = -1;
            if (navigator.appName == 'Microsoft Internet Explorer') {
                var ua = navigator.userAgent,
                    re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
                if (re.exec(ua) != null)
                    rv = parseFloat(RegExp.$1);
            }
            return rv;
        })(),
        isIELT9 = iev > -1 && iev < 9,
        _genLoc = function (e, prefix) {
            if (e == null) return [ 0, 0 ];
            var ts = _touches(e), t = _getTouch(ts, 0);
            return [t[prefix + "X"], t[prefix + "Y"]];
        },
        _pageLocation = function (e) {
            if (e == null) return [ 0, 0 ];
            if (isIELT9) {
                return [ e.clientX + document.documentElement.scrollLeft, e.clientY + document.documentElement.scrollTop ];
            }
            else {
                return _genLoc(e, "page");
            }
        },
        _screenLocation = function (e) {
            return _genLoc(e, "screen");
        },
        _clientLocation = function (e) {
            return _genLoc(e, "client");
        },
        _getTouch = function (touches, idx) {
            return touches.item ? touches.item(idx) : touches[idx];
        },
        _touches = function (e) {
            return e.touches && e.touches.length > 0 ? e.touches :
                    e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches :
                    e.targetTouches && e.targetTouches.length > 0 ? e.targetTouches :
                [ e ];
        },
        _touchCount = function (e) {
            return _touches(e).length;
        },
    //http://www.quirksmode.org/blog/archives/2005/10/_and_the_winner_1.html
        _bind = function (obj, type, fn, originalFn) {
            _store(obj, type, fn);
            originalFn.__tauid = fn.__tauid;
            if (obj.addEventListener)
                obj.addEventListener(type, fn, false);
            else if (obj.attachEvent) {
                var key = type + fn.__tauid;
                obj["e" + key] = fn;
                // TODO look at replacing with .call(..)
                obj[key] = function () {
                    obj["e" + key] && obj["e" + key](window.event);
                };
                obj.attachEvent("on" + type, obj[key]);
            }
        },
        _unbind = function (obj, type, fn) {
            if (fn == null) return;
            _each(obj, function () {
                var _el = _gel(this);
                _unstore(_el, type, fn);
                // it has been bound if there is a tauid. otherwise it was not bound and we can ignore it.
                if (fn.__tauid != null) {
                    if (_el.removeEventListener) {
                        _el.removeEventListener(type, fn, false);
                        if (isTouchDevice && touchMap[type]) _el.removeEventListener(touchMap[type], fn, false);
                    }
                    else if (this.detachEvent) {
                        var key = type + fn.__tauid;
                        _el[key] && _el.detachEvent("on" + type, _el[key]);
                        _el[key] = null;
                        _el["e" + key] = null;
                    }
                }

                // if a touch event was also registered, deregister now.
                if (fn.__taTouchProxy) {
                    _unbind(obj, fn.__taTouchProxy[1], fn.__taTouchProxy[0]);
                }
            });
        },
        _each = function (obj, fn) {
            if (obj == null) return;
            // if a list (or list-like), use it. if a string, get a list
            // by running the string through querySelectorAll. else, assume
            // it's an Element.
            // obj.top is "unknown" in IE8.
            obj = (typeof Window !== "undefined" && (typeof obj.top !== "unknown" && obj == obj.top)) ? [ obj ] :
                    (typeof obj !== "string") && (obj.tagName == null && obj.length != null) ? obj :
                    typeof obj === "string" ? document.querySelectorAll(obj)
                : [ obj ];

            for (var i = 0; i < obj.length; i++)
                fn.apply(obj[i]);
        },
        _uuid = function () {
            return ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            }));
        };

    /**
     * Mottle offers support for abstracting out the differences
     * between touch and mouse devices, plus "smart click" functionality
     * (don't fire click if the mouse has moved between mousedown and mouseup),
     * and synthesized click/tap events.
     * @class Mottle
     * @constructor
     * @param {Object} params Constructor params
     * @param {Number} [params.clickThreshold=250] Threshold, in milliseconds beyond which a touchstart followed by a touchend is not considered to be a click.
     * @param {Number} [params.dblClickThreshold=450] Threshold, in milliseconds beyond which two successive tap events are not considered to be a click.
     * @param {Boolean} [params.smartClicks=false] If true, won't fire click events if the mouse has moved between mousedown and mouseup. Note that this functionality
     * requires that Mottle consume the mousedown event, and so may not be viable in all use cases.
     */
    root.Mottle = function (params) {
        params = params || {};
        var clickThreshold = params.clickThreshold || 250,
            dblClickThreshold = params.dblClickThreshold || 450,
            mouseEnterExitHandler = new MouseEnterExitHandler(),
            tapHandler = new TapHandler(clickThreshold, dblClickThreshold),
            _smartClicks = params.smartClicks,
            _doBind = function (obj, evt, fn, children) {
                if (fn == null) return;
                _each(obj, function () {
                    var _el = _gel(this);
                    if (_smartClicks && evt === "click")
                        SmartClickHandler(_el, evt, fn, children);
                    else if (evt === "tap" || evt === "dbltap" || evt === "contextmenu") {
                        tapHandler(_el, evt, fn, children);
                    }
                    else if (evt === "mouseenter" || evt == "mouseexit")
                        mouseEnterExitHandler(_el, evt, fn, children);
                    else
                        DefaultHandler(_el, evt, fn, children);
                });
            };

        /**
         * Removes an element from the DOM, and deregisters all event handlers for it. You should use this
         * to ensure you don't leak memory.
         * @method remove
         * @param {String|Element} el Element, or id of the element, to remove.
         * @return {Mottle} The current Mottle instance; you can chain this method.
         */
        this.remove = function (el) {
            _each(el, function () {
                var _el = _gel(this);
                if (_el.__ta) {
                    for (var evt in _el.__ta) {
                        if (_el.__ta.hasOwnProperty(evt)) {
                            for (var h in _el.__ta[evt]) {
                                if (_el.__ta[evt].hasOwnProperty(h))
                                    _unbind(_el, evt, _el.__ta[evt][h]);
                            }
                        }
                    }
                }
                _el.parentNode && _el.parentNode.removeChild(_el);
            });
            return this;
        };

        /**
         * Register an event handler, optionally as a delegate for some set of descendant elements. Note
         * that this method takes either 3 or 4 arguments - if you supply 3 arguments it is assumed you have
         * omitted the `children` parameter, and that the event handler should be bound directly to the given element.
         * @method on
         * @param {Element[]|Element|String} el Either an Element, or a CSS spec for a list of elements, or an array of Elements.
         * @param {String} [children] Comma-delimited list of selectors identifying allowed children.
         * @param {String} event Event ID.
         * @param {Function} fn Event handler function.
         * @return {Mottle} The current Mottle instance; you can chain this method.
         */
        this.on = function (el, event, children, fn) {
            var _el = arguments[0],
                _c = arguments.length == 4 ? arguments[2] : null,
                _e = arguments[1],
                _f = arguments[arguments.length - 1];

            _doBind(_el, _e, _f, _c);
            return this;
        };

        /**
         * Cancel delegate event handling for the given function. Note that unlike with 'on' you do not supply
         * a list of child selectors here: it removes event delegation from all of the child selectors for which the
         * given function was registered (if any).
         * @method off
         * @param {Element[]|Element|String} el Element - or ID of element - from which to remove event listener.
         * @param {String} event Event ID.
         * @param {Function} fn Event handler function.
         * @return {Mottle} The current Mottle instance; you can chain this method.
         */
        this.off = function (el, event, fn) {
            _unbind(el, event, fn);
            return this;
        };

        /**
         * Triggers some event for a given element.
         * @method trigger
         * @param {Element} el Element for which to trigger the event.
         * @param {String} event Event ID.
         * @param {Event} originalEvent The original event. Should be optional of course, but currently is not, due
         * to the jsPlumb use case that caused this method to be added.
         * @param {Object} [payload] Optional object to set as `payload` on the generated event; useful for message passing.
         * @return {Mottle} The current Mottle instance; you can chain this method.
         */
        this.trigger = function (el, event, originalEvent, payload) {
            // MouseEvent undefined in old IE; that's how we know it's a mouse event.  A fine Microsoft paradox.
            var originalIsMouse = isMouseDevice && (typeof MouseEvent === "undefined" || originalEvent == null || originalEvent.constructor === MouseEvent);

            var eventToBind = (isTouchDevice && !isMouseDevice && touchMap[event]) ? touchMap[event] : event,
                bindingAMouseEvent = !(isTouchDevice && !isMouseDevice && touchMap[event]);

            var pl = _pageLocation(originalEvent), sl = _screenLocation(originalEvent), cl = _clientLocation(originalEvent);
            _each(el, function () {
                var _el = _gel(this), evt;
                originalEvent = originalEvent || {
                    screenX: sl[0],
                    screenY: sl[1],
                    clientX: cl[0],
                    clientY: cl[1]
                };

                var _decorate = function (_evt) {
                    if (payload) _evt.payload = payload;
                };

                var eventGenerators = {
                    "TouchEvent": function (evt) {

                        var touchList = _touchAndList(window, _el, 0, pl[0], pl[1], sl[0], sl[1], cl[0], cl[1]),
                            init = evt.initTouchEvent || evt.initEvent;

                        init(eventToBind, true, true, window, null, sl[0], sl[1],
                            cl[0], cl[1], false, false, false, false,
                            touchList, touchList, touchList, 1, 0);
                    },
                    "MouseEvents": function (evt) {
                        evt.initMouseEvent(eventToBind, true, true, window, 0,
                            sl[0], sl[1],
                            cl[0], cl[1],
                            false, false, false, false, 1, _el);
                    }
                };

                if (document.createEvent) {

                    var ite = !bindingAMouseEvent && !originalIsMouse && (isTouchDevice && touchMap[event]),
                        evtName = ite ? "TouchEvent" : "MouseEvents";

                    evt = document.createEvent(evtName);
                    eventGenerators[evtName](evt);
                    _decorate(evt);
                    _el.dispatchEvent(evt);
                }
                else if (document.createEventObject) {
                    evt = document.createEventObject();
                    evt.eventType = evt.eventName = eventToBind;
                    evt.screenX = sl[0];
                    evt.screenY = sl[1];
                    evt.clientX = cl[0];
                    evt.clientY = cl[1];
                    _decorate(evt);
                    _el.fireEvent('on' + eventToBind, evt);
                }
            });
            return this;
        }
    };

    /**
     * Static method to assist in 'consuming' an element: uses `stopPropagation` where available, or sets
     * `e.returnValue=false` where it is not.
     * @method Mottle.consume
     * @param {Event} e Event to consume
     * @param {Boolean} [doNotPreventDefault=false] If true, does not call `preventDefault()` on the event.
     */
    root.Mottle.consume = function (e, doNotPreventDefault) {
        if (e.stopPropagation)
            e.stopPropagation();
        else
            e.returnValue = false;

        if (!doNotPreventDefault && e.preventDefault)
            e.preventDefault();
    };

    /**
     * Gets the page location corresponding to the given event. For touch events this means get the page location of the first touch.
     * @method Mottle.pageLocation
     * @param {Event} e Event to get page location for.
     * @return {Number[]} [left, top] for the given event.
     */
    root.Mottle.pageLocation = _pageLocation;

    /**
     * Forces touch events to be turned "on". Useful for testing: even if you don't have a touch device, you can still
     * trigger a touch event when this is switched on and it will be captured and acted on.
     * @method setForceTouchEvents
     * @param {Boolean} value If true, force touch events to be on.
     */
    root.Mottle.setForceTouchEvents = function (value) {
        isTouchDevice = value;
    };

    /**
     * Forces mouse events to be turned "on". Useful for testing: even if you don't have a mouse, you can still
     * trigger a mouse event when this is switched on and it will be captured and acted on.
     * @method setForceMouseEvents
     * @param {Boolean} value If true, force mouse events to be on.
     */
    root.Mottle.setForceMouseEvents = function (value) {
        isMouseDevice = value;
    };

    root.Mottle.version = "0.8.0";

    if (typeof exports !== "undefined") {
        exports.Mottle = root.Mottle;
    }

}).call(typeof window === "undefined" ? this : window);

/**
 drag/drop functionality for use with jsPlumb but with
 no knowledge of jsPlumb. supports multiple scopes (separated by whitespace), dragging
 multiple elements, constrain to parent, drop filters, drag start filters, custom
 css classes.

 a lot of the functionality of this script is expected to be plugged in:

 addClass
 removeClass

 addEvent
 removeEvent

 getPosition
 setPosition
 getSize

 indexOf
 intersects

 the name came from here:

 http://mrsharpoblunto.github.io/foswig.js/

 copyright 2016 jsPlumb
 */

;(function() {

    "use strict";
    var root = this;

    var _suggest = function(list, item, head) {
        if (list.indexOf(item) === -1) {
            head ? list.unshift(item) : list.push(item);
            return true;
        }
        return false;
    };

    var _vanquish = function(list, item) {
        var idx = list.indexOf(item);
        if (idx !== -1) list.splice(idx, 1);
    };

    var _difference = function(l1, l2) {
        var d = [];
        for (var i = 0; i < l1.length; i++) {
            if (l2.indexOf(l1[i]) === -1)
                d.push(l1[i]);
        }
        return d;
    };

    var _isString = function(f) {
        return f == null ? false : (typeof f === "string" || f.constructor === String);
    };

    var getOffsetRect = function (elem) {
        // (1)
        var box = elem.getBoundingClientRect(),
            body = document.body,
            docElem = document.documentElement,
        // (2)
            scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop,
            scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft,
        // (3)
            clientTop = docElem.clientTop || body.clientTop || 0,
            clientLeft = docElem.clientLeft || body.clientLeft || 0,
        // (4)
            top  = box.top +  scrollTop - clientTop,
            left = box.left + scrollLeft - clientLeft;

        return { top: Math.round(top), left: Math.round(left) };
    };

    var matchesSelector = function(el, selector, ctx) {
        ctx = ctx || el.parentNode;
        var possibles = ctx.querySelectorAll(selector);
        for (var i = 0; i < possibles.length; i++) {
            if (possibles[i] === el)
                return true;
        }
        return false;
    };

    var findDelegateElement = function(parentElement, childElement, selector) {
        if (matchesSelector(childElement, selector, parentElement)) {
            return childElement;
        } else {
            var currentParent = childElement.parentNode;
            while (currentParent != null && currentParent !== parentElement) {
                if (matchesSelector(currentParent, selector, parentElement)) {
                    return currentParent;
                } else {
                    currentParent = currentParent.parentNode;
                }
            }
        }
    };

    /**
     * Finds all elements matching the given selector, for the given parent. In order to support "scoped root" selectors,
     * ie. things like "> .someClass", that is .someClass elements that are direct children of `parentElement`, we have to
     * jump through a small hoop here: when a delegate draggable is registered, we write a `katavorio-draggable` attribute
     * on the element on which the draggable is registered. Then when this method runs, we grab the value of that attribute and
     * prepend it as part of the selector we're looking for.  So "> .someClass" ends up being written as
     * "[katavorio-draggable='...' > .someClass]", which works with querySelectorAll.
     *
     * @param availableSelectors
     * @param parentElement
     * @param childElement
     * @returns {*}
     */
    var findMatchingSelector = function(availableSelectors, parentElement, childElement) {
        var el = null;
        var draggableId = parentElement.getAttribute("katavorio-draggable"),
            prefix = draggableId != null ? "[katavorio-draggable='" + draggableId + "'] " : "";

        for (var i = 0; i < availableSelectors.length; i++) {
            el = findDelegateElement(parentElement, childElement, prefix + availableSelectors[i].selector);
            if (el != null) {
                return [ availableSelectors[i], el ];
            }
        }
        return null;
    };

    var iev = (function() {
            var rv = -1;
            if (navigator.appName === 'Microsoft Internet Explorer') {
                var ua = navigator.userAgent,
                    re = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
                if (re.exec(ua) != null)
                    rv = parseFloat(RegExp.$1);
            }
            return rv;
        })(),
        DEFAULT_GRID_X = 10,
        DEFAULT_GRID_Y = 10,
        isIELT9 = iev > -1 && iev < 9,
        isIE9 = iev === 9,
        _pl = function(e) {
            if (isIELT9) {
                return [ e.clientX + document.documentElement.scrollLeft, e.clientY + document.documentElement.scrollTop ];
            }
            else {
                var ts = _touches(e), t = _getTouch(ts, 0);
                // for IE9 pageX might be null if the event was synthesized. We try for pageX/pageY first,
                // falling back to clientX/clientY if necessary. In every other browser we want to use pageX/pageY.
                return isIE9 ? [t.pageX || t.clientX, t.pageY || t.clientY] : [t.pageX, t.pageY];
            }
        },
        _getTouch = function(touches, idx) { return touches.item ? touches.item(idx) : touches[idx]; },
        _touches = function(e) {
            return e.touches && e.touches.length > 0 ? e.touches :
                    e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches :
                    e.targetTouches && e.targetTouches.length > 0 ? e.targetTouches :
                [ e ];
        },
        _classes = {
            delegatedDraggable:"katavorio-delegated-draggable",  // elements that are the delegated drag handler for a bunch of other elements
            draggable:"katavorio-draggable",    // draggable elements
            droppable:"katavorio-droppable",    // droppable elements
            drag : "katavorio-drag",            // elements currently being dragged
            selected:"katavorio-drag-selected", // elements in current drag selection
            active : "katavorio-drag-active",   // droppables that are targets of a currently dragged element
            hover : "katavorio-drag-hover",     // droppables over which a matching drag element is hovering
            noSelect : "katavorio-drag-no-select", // added to the body to provide a hook to suppress text selection
            ghostProxy:"katavorio-ghost-proxy",  // added to a ghost proxy element in use when a drag has exited the bounds of its parent.
            clonedDrag:"katavorio-clone-drag"     // added to a node that is a clone of an element created at the start of a drag
        },
        _defaultScope = "katavorio-drag-scope",
        _events = [ "stop", "start", "drag", "drop", "over", "out", "beforeStart" ],
        _devNull = function() {},
        _true = function() { return true; },
        _foreach = function(l, fn, from) {
            for (var i = 0; i < l.length; i++) {
                if (l[i] != from)
                    fn(l[i]);
            }
        },
        _setDroppablesActive = function(dd, val, andHover, drag) {
            _foreach(dd, function(e) {
                e.setActive(val);
                if (val) e.updatePosition();
                if (andHover) e.setHover(drag, val);
            });
        },
        _each = function(obj, fn) {
            if (obj == null) return;
            obj = !_isString(obj) && (obj.tagName == null && obj.length != null) ? obj : [ obj ];
            for (var i = 0; i < obj.length; i++)
                fn.apply(obj[i], [ obj[i] ]);
        },
        _consume = function(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
                e.preventDefault();
            }
            else {
                e.returnValue = false;
            }
        },
        _defaultInputFilterSelector = "input,textarea,select,button,option",
    //
    // filters out events on all input elements, like textarea, checkbox, input, select.
        _inputFilter = function(e, el, _katavorio) {
            var t = e.srcElement || e.target;
            return !matchesSelector(t, _katavorio.getInputFilterSelector(), el);
        };

    var Super = function(el, params, css, scope) {
        this.params = params || {};
        this.el = el;
        this.params.addClass(this.el, this._class);
        this.uuid = _uuid();
        var enabled = true;
        this.setEnabled = function(e) { enabled = e; };
        this.isEnabled = function() { return enabled; };
        this.toggleEnabled = function() { enabled = !enabled; };
        this.setScope = function(scopes) {
            this.scopes = scopes ? scopes.split(/\s+/) : [ scope ];
        };
        this.addScope = function(scopes) {
            var m = {};
            _each(this.scopes, function(s) { m[s] = true;});
            _each(scopes ? scopes.split(/\s+/) : [], function(s) { m[s] = true;});
            this.scopes = [];
            for (var i in m) this.scopes.push(i);
        };
        this.removeScope = function(scopes) {
            var m = {};
            _each(this.scopes, function(s) { m[s] = true;});
            _each(scopes ? scopes.split(/\s+/) : [], function(s) { delete m[s];});
            this.scopes = [];
            for (var i in m) this.scopes.push(i);
        };
        this.toggleScope = function(scopes) {
            var m = {};
            _each(this.scopes, function(s) { m[s] = true;});
            _each(scopes ? scopes.split(/\s+/) : [], function(s) {
                if (m[s]) delete m[s];
                else m[s] = true;
            });
            this.scopes = [];
            for (var i in m) this.scopes.push(i);
        };
        this.setScope(params.scope);
        this.k = params.katavorio;
        return params.katavorio;
    };

    var TRUE = function() { return true; };
    var FALSE = function() { return false; };

    var Drag = function(el, params, css, scope) {
        this._class = css.draggable;
        var k = Super.apply(this, arguments);
        this.rightButtonCanDrag = this.params.rightButtonCanDrag;
        var downAt = [0,0], posAtDown = null, pagePosAtDown = null, pageDelta = [0,0], moving = false, initialScroll = [0,0],
            consumeStartEvent = this.params.consumeStartEvent !== false,
            dragEl = this.el,
            clone = this.params.clone,
            scroll = this.params.scroll,
            _multipleDrop = params.multipleDrop !== false,
            isConstrained = false,
            useGhostProxy = params.ghostProxy === true ? TRUE : params.ghostProxy && typeof params.ghostProxy === "function" ? params.ghostProxy : FALSE,
            ghostProxy = function(el) { return el.cloneNode(true); },
            elementToDrag = null,
            availableSelectors = [],
            activeSelectorParams = null, // which, if any, selector config is currently active.
            ghostProxyParent = params.ghostProxyParent,
            currentParentPosition,
            ghostParentPosition,
            ghostDx,
            ghostDy;

        // if an initial selector was provided, push the entire set of params as a selector config.
        if (params.selector) {
            var draggableId = el.getAttribute("katavorio-draggable");
            if (draggableId == null) {
                draggableId = "" + new Date().getTime();
                el.setAttribute("katavorio-draggable", draggableId);
            }

            availableSelectors.push(params);
        }

        var snapThreshold = params.snapThreshold,
            _snap = function(pos, gridX, gridY, thresholdX, thresholdY) {
                var _dx = Math.floor(pos[0] / gridX),
                    _dxl = gridX * _dx,
                    _dxt = _dxl + gridX,
                    _x = Math.abs(pos[0] - _dxl) <= thresholdX ? _dxl : Math.abs(_dxt - pos[0]) <= thresholdX ? _dxt : pos[0];

                var _dy = Math.floor(pos[1] / gridY),
                    _dyl = gridY * _dy,
                    _dyt = _dyl + gridY,
                    _y = Math.abs(pos[1] - _dyl) <= thresholdY ? _dyl : Math.abs(_dyt - pos[1]) <= thresholdY ? _dyt : pos[1];

                return [ _x, _y];
            };

        this.posses = [];
        this.posseRoles = {};

        this.toGrid = function(pos) {
            if (this.params.grid == null) {
                return pos;
            }
            else {
                var tx = this.params.grid ? this.params.grid[0] / 2 : snapThreshold ? snapThreshold : DEFAULT_GRID_X / 2,
                    ty = this.params.grid ? this.params.grid[1] / 2 : snapThreshold ? snapThreshold : DEFAULT_GRID_Y / 2;

                return _snap(pos, this.params.grid[0], this.params.grid[1], tx, ty);
            }
        };

        this.snap = function(x, y) {
            if (dragEl == null) return;
            x = x || (this.params.grid ? this.params.grid[0] : DEFAULT_GRID_X);
            y = y || (this.params.grid ? this.params.grid[1] : DEFAULT_GRID_Y);
            var p = this.params.getPosition(dragEl),
                tx = this.params.grid ? this.params.grid[0] / 2 : snapThreshold,
                ty = this.params.grid ? this.params.grid[1] / 2 : snapThreshold;

            this.params.setPosition(dragEl, _snap(p, x, y, tx, ty));
        };

        this.setUseGhostProxy = function(val) {
            useGhostProxy = val ? TRUE : FALSE;
        };

        var constrain;
        var negativeFilter = function(pos) {
            return (params.allowNegative === false) ? [ Math.max (0, pos[0]), Math.max(0, pos[1]) ] : pos;
        };

        var _setConstrain = function(value) {
            constrain = typeof value === "function" ? value : value ? function(pos, dragEl, _constrainRect, _size) {
                return negativeFilter([
                    Math.max(0, Math.min(_constrainRect.w - _size[0], pos[0])),
                    Math.max(0, Math.min(_constrainRect.h - _size[1], pos[1]))
                ]);
            }.bind(this) : function(pos) { return negativeFilter(pos); };
        }.bind(this);

        _setConstrain(typeof this.params.constrain === "function" ? this.params.constrain  : (this.params.constrain || this.params.containment));


        /**
         * Sets whether or not the Drag is constrained. A value of 'true' means constrain to parent bounds; a function
         * will be executed and returns true if the position is allowed.
         * @param value
         */
        this.setConstrain = function(value) {
            _setConstrain(value);
        };

        var revertFunction;
        /**
         * Sets a function to call on drag stop, which, if it returns true, indicates that the given element should
         * revert to its position before the previous drag.
         * @param fn
         */
        this.setRevert = function(fn) {
            revertFunction = fn;
        };

        if (this.params.revert) {
            revertFunction = this.params.revert;
        }

        var _assignId = function(obj) {
                if (typeof obj === "function") {
                    obj._katavorioId = _uuid();
                    return obj._katavorioId;
                } else {
                    return obj;
                }
            },
        // a map of { spec -> [ fn, exclusion ] } entries.
            _filters = {},
            _testFilter = function(e) {
                for (var key in _filters) {
                    var f = _filters[key];
                    var rv = f[0](e);
                    if (f[1]) rv = !rv;
                    if (!rv) return false;
                }
                return true;
            },
            _setFilter = this.setFilter = function(f, _exclude) {
                if (f) {
                    var key = _assignId(f);
                    _filters[key] = [
                        function(e) {
                            var t = e.srcElement || e.target, m;
                            if (_isString(f)) {
                                m = matchesSelector(t, f, el);
                            }
                            else if (typeof f === "function") {
                                m = f(e, el);
                            }
                            return m;
                        },
                            _exclude !== false
                    ];

                }
            },
            _addFilter = this.addFilter = _setFilter,
            _removeFilter = this.removeFilter = function(f) {
                var key = typeof f === "function" ? f._katavorioId : f;
                delete _filters[key];
            };

        this.clearAllFilters = function() {
            _filters = {};
        };

        this.canDrag = this.params.canDrag || _true;

        var constrainRect,
            matchingDroppables = [],
            intersectingDroppables = [];

        this.addSelector = function(params) {
            if (params.selector) {
                availableSelectors.push(params);
            }
        };

        this.downListener = function(e) {
            if (e.defaultPrevented) { return; }
            var isNotRightClick = this.rightButtonCanDrag || (e.which !== 3 && e.button !== 2);
            if (isNotRightClick && this.isEnabled() && this.canDrag()) {

                var _f =  _testFilter(e) && _inputFilter(e, this.el, this.k);
                if (_f) {

                    activeSelectorParams = null;
                    elementToDrag = null;

                    // if (selector) {
                    //     elementToDrag = findDelegateElement(this.el, e.target || e.srcElement, selector);
                    //     if(elementToDrag == null) {
                    //         return;
                    //     }
                    // }
                    if (availableSelectors.length > 0) {
                        var match = findMatchingSelector(availableSelectors, this.el, e.target || e.srcElement);
                        if (match != null) {
                            activeSelectorParams = match[0];
                            elementToDrag = match[1];
                        }
                        // elementToDrag = findDelegateElement(this.el, e.target || e.srcElement, selector);
                        if(elementToDrag == null) {
                            return;
                        }
                    }
                    else {
                        elementToDrag = this.el;
                    }

                    if (clone) {
                        dragEl = elementToDrag.cloneNode(true);
                        this.params.addClass(dragEl, _classes.clonedDrag);

                        dragEl.setAttribute("id", null);
                        dragEl.style.position = "absolute";

                        if (this.params.parent != null) {
                            var p = this.params.getPosition(this.el);
                            dragEl.style.left = p[0] + "px";
                            dragEl.style.top = p[1] + "px";
                            this.params.parent.appendChild(dragEl);
                        } else {
                            // the clone node is added to the body; getOffsetRect gives us a value
                            // relative to the body.
                            var b = getOffsetRect(elementToDrag);
                            dragEl.style.left = b.left + "px";
                            dragEl.style.top = b.top + "px";

                            document.body.appendChild(dragEl);
                        }

                    } else {
                        dragEl = elementToDrag;
                    }

                    consumeStartEvent && _consume(e);
                    downAt = _pl(e);
                    if (dragEl && dragEl.parentNode)
                    {
                        initialScroll = [dragEl.parentNode.scrollLeft, dragEl.parentNode.scrollTop];
                    }
                    //
                    this.params.bind(document, "mousemove", this.moveListener);
                    this.params.bind(document, "mouseup", this.upListener);
                    k.markSelection(this);
                    k.markPosses(this);
                    this.params.addClass(document.body, css.noSelect);
                    _dispatch("beforeStart", {el:this.el, pos:posAtDown, e:e, drag:this});
                }
                else if (this.params.consumeFilteredEvents) {
                    _consume(e);
                }
            }
        }.bind(this);

        this.moveListener = function(e) {
            if (downAt) {
                if (!moving) {
                    var _continue = _dispatch("start", {el:this.el, pos:posAtDown, e:e, drag:this});
                    if (_continue !== false) {
                        if (!downAt) {
                            return;
                        }
                        this.mark(true);
                        moving = true;
                    } else {
                        this.abort();
                    }
                }

                // it is possible that the start event caused the drag to be aborted. So we check
                // again that we are currently dragging.
                if (downAt) {
                    intersectingDroppables.length = 0;
                    var pos = _pl(e), dx = pos[0] - downAt[0], dy = pos[1] - downAt[1],
                        z = this.params.ignoreZoom ? 1 : k.getZoom();
                    if (dragEl && dragEl.parentNode)
                    {
                        dx += dragEl.parentNode.scrollLeft - initialScroll[0];
                        dy += dragEl.parentNode.scrollTop - initialScroll[1];
                    }
                    dx /= z;
                    dy /= z;
                    this.moveBy(dx, dy, e);
                    k.updateSelection(dx, dy, this);
                    k.updatePosses(dx, dy, this);
                }
            }
        }.bind(this);

        this.upListener = function(e) {
            if (downAt) {
                downAt = null;
                this.params.unbind(document, "mousemove", this.moveListener);
                this.params.unbind(document, "mouseup", this.upListener);
                this.params.removeClass(document.body, css.noSelect);
                this.unmark(e);
                k.unmarkSelection(this, e);
                k.unmarkPosses(this, e);
                this.stop(e);

                k.notifyPosseDragStop(this, e);
                moving = false;
                intersectingDroppables.length = 0;

                if (clone) {
                    dragEl && dragEl.parentNode && dragEl.parentNode.removeChild(dragEl);
                    dragEl = null;
                } else {
                    if (revertFunction && revertFunction(dragEl, this.params.getPosition(dragEl)) === true) {
                        this.params.setPosition(dragEl, posAtDown);
                        _dispatch("revert", dragEl);
                    }
                }

            }
        }.bind(this);

        this.getFilters = function() { return _filters; };

        this.abort = function() {
            if (downAt != null) {
                this.upListener();
            }
        };

        /**
         * Returns the element that was last dragged. This may be some original element from the DOM, or if `clone` is
         * set, then its actually a copy of some original DOM element. In some client calls to this method, it is the
         * actual element that was dragged that is desired. In others, it is the original DOM element that the user
         * wishes to get - in which case, pass true for `retrieveOriginalElement`.
         *
         * @returns {*}
         */
        this.getDragElement = function(retrieveOriginalElement) {
            return retrieveOriginalElement ? elementToDrag || this.el : dragEl || this.el;
        };

        var listeners = {"start":[], "drag":[], "stop":[], "over":[], "out":[], "beforeStart":[], "revert":[] };
        if (params.events.start) listeners.start.push(params.events.start);
        if (params.events.beforeStart) listeners.beforeStart.push(params.events.beforeStart);
        if (params.events.stop) listeners.stop.push(params.events.stop);
        if (params.events.drag) listeners.drag.push(params.events.drag);
        if (params.events.revert) listeners.revert.push(params.events.revert);

        this.on = function(evt, fn) {
            if (listeners[evt]) listeners[evt].push(fn);
        };

        this.off = function(evt, fn) {
            if (listeners[evt]) {
                var l = [];
                for (var i = 0; i < listeners[evt].length; i++) {
                    if (listeners[evt][i] !== fn) l.push(listeners[evt][i]);
                }
                listeners[evt] = l;
            }
        };

        var _dispatch = function(evt, value) {
            var result = null;
            if (activeSelectorParams && activeSelectorParams[evt]) {
                activeSelectorParams[evt](value);
            } else if (listeners[evt]) {
                for (var i = 0; i < listeners[evt].length; i++) {
                    try {
                        var v = listeners[evt][i](value);
                        if (v != null) {
                            result = v;
                        }
                    }
                    catch (e) { }
                }
            }
            return result;
        };

        this.notifyStart = function(e) {
            _dispatch("start", {el:this.el, pos:this.params.getPosition(dragEl), e:e, drag:this});
        };

        this.stop = function(e, force) {
            if (force || moving) {
                var positions = [],
                    sel = k.getSelection(),
                    dPos = this.params.getPosition(dragEl);

                if (sel.length > 0) {
                    for (var i = 0; i < sel.length; i++) {
                        var p = this.params.getPosition(sel[i].el);
                        positions.push([ sel[i].el, { left: p[0], top: p[1] }, sel[i] ]);
                    }
                }
                else {
                    positions.push([ dragEl, {left:dPos[0], top:dPos[1]}, this ]);
                }

                _dispatch("stop", {
                    el: dragEl,
                    pos: ghostProxyOffsets || dPos,
                    finalPos:dPos,
                    e: e,
                    drag: this,
                    selection:positions
                });
            }
        };

        this.mark = function(andNotify) {
            posAtDown = this.params.getPosition(dragEl);
            pagePosAtDown = this.params.getPosition(dragEl, true);
            pageDelta = [pagePosAtDown[0] - posAtDown[0], pagePosAtDown[1] - posAtDown[1]];
            this.size = this.params.getSize(dragEl);
            matchingDroppables = k.getMatchingDroppables(this);
            _setDroppablesActive(matchingDroppables, true, false, this);
            this.params.addClass(dragEl, this.params.dragClass || css.drag);

            var cs;
            if (this.params.getConstrainingRectangle) {
                cs = this.params.getConstrainingRectangle(dragEl)
            } else {
                cs = this.params.getSize(dragEl.parentNode);
            }
            constrainRect = {w: cs[0], h: cs[1]};

            ghostDx = 0;
            ghostDy = 0;

            if (andNotify) {
                k.notifySelectionDragStart(this);
            }
        };
        var ghostProxyOffsets;
        this.unmark = function(e, doNotCheckDroppables) {
            _setDroppablesActive(matchingDroppables, false, true, this);

            if (isConstrained && useGhostProxy(elementToDrag)) {
                ghostProxyOffsets = [dragEl.offsetLeft - ghostDx, dragEl.offsetTop - ghostDy];
                dragEl.parentNode.removeChild(dragEl);
                dragEl = elementToDrag;
            }
            else {
                ghostProxyOffsets = null;
            }

            this.params.removeClass(dragEl, this.params.dragClass || css.drag);
            matchingDroppables.length = 0;
            isConstrained = false;
            if (!doNotCheckDroppables) {
                if (intersectingDroppables.length > 0 && ghostProxyOffsets) {
                    params.setPosition(elementToDrag, ghostProxyOffsets);
                }
                intersectingDroppables.sort(_rankSort);
                for (var i = 0; i < intersectingDroppables.length; i++) {
                    var retVal = intersectingDroppables[i].drop(this, e);
                    if (retVal === true) break;
                }
            }
        };
        this.moveBy = function(dx, dy, e) {
            intersectingDroppables.length = 0;

            var desiredLoc = this.toGrid([posAtDown[0] + dx, posAtDown[1] + dy]),
                cPos = constrain(desiredLoc, dragEl, constrainRect, this.size);

            // if we should use a ghost proxy...
            if (useGhostProxy(this.el)) {
                // and the element has been dragged outside of its parent bounds
                if (desiredLoc[0] !== cPos[0] || desiredLoc[1] !== cPos[1]) {

                    // ...if ghost proxy not yet created
                    if (!isConstrained) {
                        // create it
                        var gp = ghostProxy(elementToDrag);
                        params.addClass(gp, _classes.ghostProxy);

                        if (ghostProxyParent) {
                            ghostProxyParent.appendChild(gp);
                            // find offset between drag el's parent the ghost parent
                           currentParentPosition = params.getPosition(elementToDrag.parentNode, true);
                           ghostParentPosition = params.getPosition(params.ghostProxyParent, true);
                           ghostDx = currentParentPosition[0] - ghostParentPosition[0];
                           ghostDy = currentParentPosition[1] - ghostParentPosition[1];

                        } else {
                            elementToDrag.parentNode.appendChild(gp);
                        }

                        // the ghost proxy is the drag element
                        dragEl = gp;
                        // set this flag so we dont recreate the ghost proxy
                        isConstrained = true;
                    }
                    // now the drag position can be the desired position, as the ghost proxy can support it.
                    cPos = desiredLoc;
                }
                else {
                    // if the element is not outside of its parent bounds, and ghost proxy is in place,
                    if (isConstrained) {
                        // remove the ghost proxy from the dom
                        dragEl.parentNode.removeChild(dragEl);
                        // reset the drag element to the original element
                        dragEl = elementToDrag;
                        // clear this flag.
                        isConstrained = false;
                        currentParentPosition = null;
                        ghostParentPosition = null;
                        ghostDx = 0;
                        ghostDy = 0;
                    }
                }
            }

            var rect = { x:cPos[0], y:cPos[1], w:this.size[0], h:this.size[1]},
                pageRect = { x:rect.x + pageDelta[0], y:rect.y + pageDelta[1], w:rect.w, h:rect.h},
                focusDropElement = null;

            this.params.setPosition(dragEl, [cPos[0] + ghostDx, cPos[1] + ghostDy]);

            for (var i = 0; i < matchingDroppables.length; i++) {
                var r2 = { x:matchingDroppables[i].pagePosition[0], y:matchingDroppables[i].pagePosition[1], w:matchingDroppables[i].size[0], h:matchingDroppables[i].size[1]};
                if (this.params.intersects(pageRect, r2) && (_multipleDrop || focusDropElement == null || focusDropElement === matchingDroppables[i].el) && matchingDroppables[i].canDrop(this)) {
                    if (!focusDropElement) focusDropElement = matchingDroppables[i].el;
                    intersectingDroppables.push(matchingDroppables[i]);
                    matchingDroppables[i].setHover(this, true, e);
                }
                else if (matchingDroppables[i].isHover()) {
                    matchingDroppables[i].setHover(this, false, e);
                }
            }

            _dispatch("drag", {el:this.el, pos:cPos, e:e, drag:this});

            /* test to see if the parent needs to be scrolled (future)
             if (scroll) {
             var pnsl = dragEl.parentNode.scrollLeft, pnst = dragEl.parentNode.scrollTop;
             console.log("scroll!", pnsl, pnst);
             }*/
        };
        this.destroy = function() {
            this.params.unbind(this.el, "mousedown", this.downListener);
            this.params.unbind(document, "mousemove", this.moveListener);
            this.params.unbind(document, "mouseup", this.upListener);
            this.downListener = null;
            this.upListener = null;
            this.moveListener = null;
        };

        // init:register mousedown, and perhaps set a filter
        this.params.bind(this.el, "mousedown", this.downListener);

        // if handle provided, use that.  otherwise, try to set a filter.
        // note that a `handle` selector always results in filterExclude being set to false, ie.
        // the selector defines the handle element(s).
        if (this.params.handle)
            _setFilter(this.params.handle, false);
        else
            _setFilter(this.params.filter, this.params.filterExclude);
    };

    var Drop = function(el, params, css, scope) {
        this._class = css.droppable;
        this.params = params || {};
        this.rank = params.rank || 0;
        this._activeClass = this.params.activeClass || css.active;
        this._hoverClass = this.params.hoverClass || css.hover;
        Super.apply(this, arguments);
        var hover = false;
        this.allowLoopback = this.params.allowLoopback !== false;

        this.setActive = function(val) {
            this.params[val ? "addClass" : "removeClass"](this.el, this._activeClass);
        };

        this.updatePosition = function() {
            this.position = this.params.getPosition(this.el);
            this.pagePosition = this.params.getPosition(this.el, true);
            this.size = this.params.getSize(this.el);
        };

        this.canDrop = this.params.canDrop || function(drag) {
            return true;
        };

        this.isHover = function() { return hover; };

        this.setHover = function(drag, val, e) {
            // if turning off hover but this was not the drag that caused the hover, ignore.
            if (val || this.el._katavorioDragHover == null || this.el._katavorioDragHover === drag.el._katavorio) {
                this.params[val ? "addClass" : "removeClass"](this.el, this._hoverClass);
                this.el._katavorioDragHover = val ? drag.el._katavorio : null;
                if (hover !== val) {
                    this.params.events[val ? "over" : "out"]({el: this.el, e: e, drag: drag, drop: this});
                }
                hover = val;
            }
        };

        /**
         * A drop event. `drag` is the corresponding Drag object, which may be a Drag for some specific element, or it
         * may be a Drag on some element acting as a delegate for elements contained within it.
         * @param drag
         * @param event
         * @returns {*}
         */
        this.drop = function(drag, event) {
            return this.params.events["drop"]({ drag:drag, e:event, drop:this });
        };

        this.destroy = function() {
            this._class = null;
            this._activeClass = null;
            this._hoverClass = null;
            hover = null;
        };
    };

    var _uuid = function() {
        return ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        }));
    };

    var _rankSort = function(a,b) {
        return a.rank < b.rank ? 1 : a.rank > b.rank ? -1 : 0;
    };

    var _gel = function(el) {
        if (el == null) return null;
        el = (typeof el === "string" || el.constructor === String)  ? document.getElementById(el) : el;
        if (el == null) return null;
        el._katavorio = el._katavorio || _uuid();
        return el;
    };

    root.Katavorio = function(katavorioParams) {

        var _selection = [],
            _selectionMap = {};

        this._dragsByScope = {};
        this._dropsByScope = {};
        var _zoom = 1,
            _reg = function(obj, map) {
                _each(obj, function(_obj) {
                    for(var i = 0; i < _obj.scopes.length; i++) {
                        map[_obj.scopes[i]] = map[_obj.scopes[i]] || [];
                        map[_obj.scopes[i]].push(_obj);
                    }
                });
            },
            _unreg = function(obj, map) {
                var c = 0;
                _each(obj, function(_obj) {
                    for(var i = 0; i < _obj.scopes.length; i++) {
                        if (map[_obj.scopes[i]]) {
                            var idx = katavorioParams.indexOf(map[_obj.scopes[i]], _obj);
                            if (idx !== -1) {
                                map[_obj.scopes[i]].splice(idx, 1);
                                c++;
                            }
                        }
                    }
                });

                return c > 0 ;
            },
            _getMatchingDroppables = this.getMatchingDroppables = function(drag) {
                var dd = [], _m = {};
                for (var i = 0; i < drag.scopes.length; i++) {
                    var _dd = this._dropsByScope[drag.scopes[i]];
                    if (_dd) {
                        for (var j = 0; j < _dd.length; j++) {
                            if (_dd[j].canDrop(drag) &&  !_m[_dd[j].uuid] && (_dd[j].allowLoopback || _dd[j].el !== drag.el)) {
                                _m[_dd[j].uuid] = true;
                                dd.push(_dd[j]);
                            }
                        }
                    }
                }
                dd.sort(_rankSort);
                return dd;
            },
            _prepareParams = function(p) {
                p = p || {};
                var _p = {
                    events:{}
                }, i;
                for (i in katavorioParams) _p[i] = katavorioParams[i];
                for (i in p) _p[i] = p[i];
                // events

                for (i = 0; i < _events.length; i++) {
                    _p.events[_events[i]] = p[_events[i]] || _devNull;
                }
                _p.katavorio = this;
                return _p;
            }.bind(this),
            _mistletoe = function(existingDrag, params) {
                for (var i = 0; i < _events.length; i++) {
                    if (params[_events[i]]) {
                        existingDrag.on(_events[i], params[_events[i]]);
                    }
                }
            }.bind(this),
            _css = {},
            overrideCss = katavorioParams.css || {},
            _scope = katavorioParams.scope || _defaultScope;

        // prepare map of css classes based on defaults frst, then optional overrides
        for (var i in _classes) _css[i] = _classes[i];
        for (var i in overrideCss) _css[i] = overrideCss[i];

        var inputFilterSelector = katavorioParams.inputFilterSelector || _defaultInputFilterSelector;
        /**
         * Gets the selector identifying which input elements to filter from drag events.
         * @method getInputFilterSelector
         * @return {String} Current input filter selector.
         */
        this.getInputFilterSelector = function() { return inputFilterSelector; };

        /**
         * Sets the selector identifying which input elements to filter from drag events.
         * @method setInputFilterSelector
         * @param {String} selector Input filter selector to set.
         * @return {Katavorio} Current instance; method may be chained.
         */
        this.setInputFilterSelector = function(selector) {
            inputFilterSelector = selector;
            return this;
        };

        /**
         * Either makes the given element draggable, or identifies it as an element inside which some identified list
         * of elements may be draggable.
         * @param el
         * @param params
         * @returns {Array}
         */
        this.draggable = function(el, params) {
            var o = [];
            _each(el, function (_el) {
                _el = _gel(_el);
                if (_el != null) {
                    if (_el._katavorioDrag == null) {
                        var p = _prepareParams(params);
                        _el._katavorioDrag = new Drag(_el, p, _css, _scope);
                        _reg(_el._katavorioDrag, this._dragsByScope);
                        o.push(_el._katavorioDrag);
                        katavorioParams.addClass(_el, p.selector ? _css.delegatedDraggable : _css.draggable);
                    }
                    else {
                        _mistletoe(_el._katavorioDrag, params);
                    }
                }
            }.bind(this));
            return o;
        };

        this.droppable = function(el, params) {
            var o = [];
            _each(el, function(_el) {
                _el = _gel(_el);
                if (_el != null) {
                    var drop = new Drop(_el, _prepareParams(params), _css, _scope);
                    _el._katavorioDrop = _el._katavorioDrop || [];
                    _el._katavorioDrop.push(drop);
                    _reg(drop, this._dropsByScope);
                    o.push(drop);
                    katavorioParams.addClass(_el, _css.droppable);
                }
            }.bind(this));
            return o;
        };

        /**
         * @name Katavorio#select
         * @function
         * @desc Adds an element to the current selection (for multiple node drag)
         * @param {Element|String} DOM element - or id of the element - to add.
         */
        this.select = function(el) {
            _each(el, function() {
                var _el = _gel(this);
                if (_el && _el._katavorioDrag) {
                    if (!_selectionMap[_el._katavorio]) {
                        _selection.push(_el._katavorioDrag);
                        _selectionMap[_el._katavorio] = [ _el, _selection.length - 1 ];
                        katavorioParams.addClass(_el, _css.selected);
                    }
                }
            });
            return this;
        };

        /**
         * @name Katavorio#deselect
         * @function
         * @desc Removes an element from the current selection (for multiple node drag)
         * @param {Element|String} DOM element - or id of the element - to remove.
         */
        this.deselect = function(el) {
            _each(el, function() {
                var _el = _gel(this);
                if (_el && _el._katavorio) {
                    var e = _selectionMap[_el._katavorio];
                    if (e) {
                        var _s = [];
                        for (var i = 0; i < _selection.length; i++)
                            if (_selection[i].el !== _el) _s.push(_selection[i]);
                        _selection = _s;
                        delete _selectionMap[_el._katavorio];
                        katavorioParams.removeClass(_el, _css.selected);
                    }
                }
            });
            return this;
        };

        this.deselectAll = function() {
            for (var i in _selectionMap) {
                var d = _selectionMap[i];
                katavorioParams.removeClass(d[0], _css.selected);
            }

            _selection.length = 0;
            _selectionMap = {};
        };

        this.markSelection = function(drag) {
            _foreach(_selection, function(e) { e.mark(); }, drag);
        };

        this.markPosses = function(drag) {
            if (drag.posses) {
                _each(drag.posses, function(p) {
                    if (drag.posseRoles[p] && _posses[p]) {
                        _foreach(_posses[p].members, function (d) {
                            d.mark();
                        }, drag);
                    }
                })
            }
        };

        this.unmarkSelection = function(drag, event) {
            _foreach(_selection, function(e) { e.unmark(event); }, drag);
        };

        this.unmarkPosses = function(drag, event) {
            if (drag.posses) {
                _each(drag.posses, function(p) {
                    if (drag.posseRoles[p] && _posses[p]) {
                        _foreach(_posses[p].members, function (d) {
                            d.unmark(event, true);
                        }, drag);
                    }
                });
            }
        };

        this.getSelection = function() { return _selection.slice(0); };

        this.updateSelection = function(dx, dy, drag) {
            _foreach(_selection, function(e) { e.moveBy(dx, dy); }, drag);
        };

        var _posseAction = function(fn, drag) {
            if (drag.posses) {
                _each(drag.posses, function(p) {
                    if (drag.posseRoles[p] && _posses[p]) {
                        _foreach(_posses[p].members, function (e) {
                            fn(e);
                        }, drag);
                    }
                });
            }
        };

        this.updatePosses = function(dx, dy, drag) {
            _posseAction(function(e) { e.moveBy(dx, dy); }, drag);
        };

        this.notifyPosseDragStop = function(drag, evt) {
            _posseAction(function(e) { e.stop(evt, true); }, drag);
        };

        this.notifySelectionDragStop = function(drag, evt) {
            _foreach(_selection, function(e) { e.stop(evt, true); }, drag);
        };

        this.notifySelectionDragStart = function(drag, evt) {
            _foreach(_selection, function(e) { e.notifyStart(evt);}, drag);
        };

        this.setZoom = function(z) { _zoom = z; };
        this.getZoom = function() { return _zoom; };

        // does the work of changing scopes
        var _scopeManip = function(kObj, scopes, map, fn) {
            _each(kObj, function(_kObj) {
                _unreg(_kObj, map);  // deregister existing scopes
                _kObj[fn](scopes); // set scopes
                _reg(_kObj, map); // register new ones
            });
        };

        _each([ "set", "add", "remove", "toggle"], function(v) {
            this[v + "Scope"] = function(el, scopes) {
                _scopeManip(el._katavorioDrag, scopes, this._dragsByScope, v + "Scope");
                _scopeManip(el._katavorioDrop, scopes, this._dropsByScope, v + "Scope");
            }.bind(this);
            this[v + "DragScope"] = function(el, scopes) {
                _scopeManip(el.constructor === Drag ? el : el._katavorioDrag, scopes, this._dragsByScope, v + "Scope");
            }.bind(this);
            this[v + "DropScope"] = function(el, scopes) {
                _scopeManip(el.constructor === Drop ? el : el._katavorioDrop, scopes, this._dropsByScope, v + "Scope");
            }.bind(this);
        }.bind(this));

        this.snapToGrid = function(x, y) {
            for (var s in this._dragsByScope) {
                _foreach(this._dragsByScope[s], function(d) { d.snap(x, y); });
            }
        };

        this.getDragsForScope = function(s) { return this._dragsByScope[s]; };
        this.getDropsForScope = function(s) { return this._dropsByScope[s]; };

        var _destroy = function(el, type, map) {
            el = _gel(el);
            if (el[type]) {

                // remove from selection, if present.
                var selIdx = _selection.indexOf(el[type]);
                if (selIdx >= 0) {
                    _selection.splice(selIdx, 1);
                }

                if (_unreg(el[type], map)) {
                    _each(el[type], function(kObj) { kObj.destroy() });
                }

                delete el[type];
            }
        };

        var _removeListener = function(el, type, evt, fn) {
            el = _gel(el);
            if (el[type]) {
                el[type].off(evt, fn);
            }
        };

        this.elementRemoved = function(el) {
            this.destroyDraggable(el);
            this.destroyDroppable(el);
        };

        /**
         * Either completely remove drag functionality from the given element, or remove a specific event handler. If you
         * call this method with a single argument - the element - all drag functionality is removed from it. Otherwise, if
         * you provide an event name and listener function, this function is de-registered (if found).
         * @param el Element to update
         * @param {string} [evt] Optional event name to unsubscribe
         * @param {Function} [fn] Optional function to unsubscribe
         */
        this.destroyDraggable = function(el, evt, fn) {
            if (arguments.length === 1) {
                _destroy(el, "_katavorioDrag", this._dragsByScope);
            } else {
                _removeListener(el, "_katavorioDrag", evt, fn);
            }
        };

        /**
         * Either completely remove drop functionality from the given element, or remove a specific event handler. If you
         * call this method with a single argument - the element - all drop functionality is removed from it. Otherwise, if
         * you provide an event name and listener function, this function is de-registered (if found).
         * @param el Element to update
         * @param {string} [evt] Optional event name to unsubscribe
         * @param {Function} [fn] Optional function to unsubscribe
         */
        this.destroyDroppable = function(el, evt, fn) {
            if (arguments.length === 1) {
                _destroy(el, "_katavorioDrop", this._dropsByScope);
            } else {
                _removeListener(el, "_katavorioDrop", evt, fn);
            }
        };

        this.reset = function() {
            this._dragsByScope = {};
            this._dropsByScope = {};
            _selection = [];
            _selectionMap = {};
            _posses = {};
        };

        // ----- groups
        var _posses = {};

        var _processOneSpec = function(el, _spec, dontAddExisting) {
            var posseId = _isString(_spec) ? _spec : _spec.id;
            var active = _isString(_spec) ? true : _spec.active !== false;
            var posse = _posses[posseId] || (function() {
                var g = {name:posseId, members:[]};
                _posses[posseId] = g;
                return g;
            })();
            _each(el, function(_el) {
                if (_el._katavorioDrag) {

                    if (dontAddExisting && _el._katavorioDrag.posseRoles[posse.name] != null) return;

                    _suggest(posse.members, _el._katavorioDrag);
                    _suggest(_el._katavorioDrag.posses, posse.name);
                    _el._katavorioDrag.posseRoles[posse.name] = active;
                }
            });
            return posse;
        };

        /**
         * Add the given element to the posse with the given id, creating the group if it at first does not exist.
         * @method addToPosse
         * @param {Element} el Element to add.
         * @param {String...|Object...} spec Variable args parameters. Each argument can be a either a String, indicating
         * the ID of a Posse to which the element should be added as an active participant, or an Object containing
         * `{ id:"posseId", active:false/true}`. In the latter case, if `active` is not provided it is assumed to be
         * true.
         * @returns {Posse|Posse[]} The Posse(s) to which the element(s) was/were added.
         */
        this.addToPosse = function(el, spec) {

            var posses = [];

            for (var i = 1; i < arguments.length; i++) {
                posses.push(_processOneSpec(el, arguments[i]));
            }

            return posses.length === 1 ? posses[0] : posses;
        };

        /**
         * Sets the posse(s) for the element with the given id, creating those that do not yet exist, and removing from
         * the element any current Posses that are not specified by this method call. This method will not change the
         * active/passive state if it is given a posse in which the element is already a member.
         * @method setPosse
         * @param {Element} el Element to set posse(s) on.
         * @param {String...|Object...} spec Variable args parameters. Each argument can be a either a String, indicating
         * the ID of a Posse to which the element should be added as an active participant, or an Object containing
         * `{ id:"posseId", active:false/true}`. In the latter case, if `active` is not provided it is assumed to be
         * true.
         * @returns {Posse|Posse[]} The Posse(s) to which the element(s) now belongs.
         */
        this.setPosse = function(el, spec) {

            var posses = [];

            for (var i = 1; i < arguments.length; i++) {
                posses.push(_processOneSpec(el, arguments[i], true).name);
            }

            _each(el, function(_el) {
                if (_el._katavorioDrag) {
                    var diff = _difference(_el._katavorioDrag.posses, posses);
                    var p = [];
                    Array.prototype.push.apply(p, _el._katavorioDrag.posses);
                    for (var i = 0; i < diff.length; i++) {
                        this.removeFromPosse(_el, diff[i]);
                    }
                }
            }.bind(this));

            return posses.length === 1 ? posses[0] : posses;
        };

        /**
         * Remove the given element from the given posse(s).
         * @method removeFromPosse
         * @param {Element} el Element to remove.
         * @param {String...} posseId Varargs parameter: one value for each posse to remove the element from.
         */
        this.removeFromPosse = function(el, posseId) {
            if (arguments.length < 2) throw new TypeError("No posse id provided for remove operation");
            for(var i = 1; i < arguments.length; i++) {
                posseId = arguments[i];
                _each(el, function (_el) {
                    if (_el._katavorioDrag && _el._katavorioDrag.posses) {
                        var d = _el._katavorioDrag;
                        _each(posseId, function (p) {
                            _vanquish(_posses[p].members, d);
                            _vanquish(d.posses, p);
                            delete d.posseRoles[p];
                        });
                    }
                });
            }
        };

        /**
         * Remove the given element from all Posses to which it belongs.
         * @method removeFromAllPosses
         * @param {Element|Element[]} el Element to remove from Posses.
         */
        this.removeFromAllPosses = function(el) {
            _each(el, function(_el) {
                if (_el._katavorioDrag && _el._katavorioDrag.posses) {
                    var d = _el._katavorioDrag;
                    _each(d.posses, function(p) {
                        _vanquish(_posses[p].members, d);
                    });
                    d.posses.length = 0;
                    d.posseRoles = {};
                }
            });
        };

        /**
         * Changes the participation state for the element in the Posse with the given ID.
         * @param {Element|Element[]} el Element(s) to change state for.
         * @param {String} posseId ID of the Posse to change element state for.
         * @param {Boolean} state True to make active, false to make passive.
         */
        this.setPosseState = function(el, posseId, state) {
            var posse = _posses[posseId];
            if (posse) {
                _each(el, function(_el) {
                    if (_el._katavorioDrag && _el._katavorioDrag.posses) {
                        _el._katavorioDrag.posseRoles[posse.name] = state;
                    }
                });
            }
        };

    };

    root.Katavorio.version = "1.0.0";

    if (typeof exports !== "undefined") {
        exports.Katavorio = root.Katavorio;
    }

}).call(typeof window !== 'undefined' ? window : this);


(function() {

    var root = this;
    root.jsPlumbUtil = root.jsPlumbUtil || {};
    var jsPlumbUtil = root.jsPlumbUtil;

    if (typeof exports !=='undefined') { exports.jsPlumbUtil = jsPlumbUtil;}


    function isArray(a) {
        return Object.prototype.toString.call(a) === "[object Array]";
    }
    jsPlumbUtil.isArray = isArray;
    function isNumber(n) {
        return Object.prototype.toString.call(n) === "[object Number]";
    }
    jsPlumbUtil.isNumber = isNumber;
    function isString(s) {
        return typeof s === "string";
    }
    jsPlumbUtil.isString = isString;
    function isBoolean(s) {
        return typeof s === "boolean";
    }
    jsPlumbUtil.isBoolean = isBoolean;
    function isNull(s) {
        return s == null;
    }
    jsPlumbUtil.isNull = isNull;
    function isObject(o) {
        return o == null ? false : Object.prototype.toString.call(o) === "[object Object]";
    }
    jsPlumbUtil.isObject = isObject;
    function isDate(o) {
        return Object.prototype.toString.call(o) === "[object Date]";
    }
    jsPlumbUtil.isDate = isDate;
    function isFunction(o) {
        return Object.prototype.toString.call(o) === "[object Function]";
    }
    jsPlumbUtil.isFunction = isFunction;
    function isNamedFunction(o) {
        return isFunction(o) && o.name != null && o.name.length > 0;
    }
    jsPlumbUtil.isNamedFunction = isNamedFunction;
    function isEmpty(o) {
        for (var i in o) {
            if (o.hasOwnProperty(i)) {
                return false;
            }
        }
        return true;
    }
    jsPlumbUtil.isEmpty = isEmpty;
    function clone(a) {
        if (isString(a)) {
            return "" + a;
        }
        else if (isBoolean(a)) {
            return !!a;
        }
        else if (isDate(a)) {
            return new Date(a.getTime());
        }
        else if (isFunction(a)) {
            return a;
        }
        else if (isArray(a)) {
            var b = [];
            for (var i = 0; i < a.length; i++) {
                b.push(clone(a[i]));
            }
            return b;
        }
        else if (isObject(a)) {
            var c = {};
            for (var j in a) {
                c[j] = clone(a[j]);
            }
            return c;
        }
        else {
            return a;
        }
    }
    jsPlumbUtil.clone = clone;
    function merge(a, b, collations, overwrites) {
        // first change the collations array - if present - into a lookup table, because its faster.
        var cMap = {}, ar, i, oMap = {};
        collations = collations || [];
        overwrites = overwrites || [];
        for (i = 0; i < collations.length; i++) {
            cMap[collations[i]] = true;
        }
        for (i = 0; i < overwrites.length; i++) {
            oMap[overwrites[i]] = true;
        }
        var c = clone(a);
        for (i in b) {
            if (c[i] == null || oMap[i]) {
                c[i] = b[i];
            }
            else if (isString(b[i]) || isBoolean(b[i])) {
                if (!cMap[i]) {
                    c[i] = b[i]; // if we dont want to collate, just copy it in.
                }
                else {
                    ar = [];
                    // if c's object is also an array we can keep its values.
                    ar.push.apply(ar, isArray(c[i]) ? c[i] : [c[i]]);
                    ar.push.apply(ar, isBoolean(b[i]) ? b[i] : [b[i]]);
                    c[i] = ar;
                }
            }
            else {
                if (isArray(b[i])) {
                    ar = [];
                    // if c's object is also an array we can keep its values.
                    if (isArray(c[i])) {
                        ar.push.apply(ar, c[i]);
                    }
                    ar.push.apply(ar, b[i]);
                    c[i] = ar;
                }
                else if (isObject(b[i])) {
                    // overwrite c's value with an object if it is not already one.
                    if (!isObject(c[i])) {
                        c[i] = {};
                    }
                    for (var j in b[i]) {
                        c[i][j] = b[i][j];
                    }
                }
            }
        }
        return c;
    }
    jsPlumbUtil.merge = merge;
    function replace(inObj, path, value) {
        if (inObj == null) {
            return;
        }
        var q = inObj, t = q;
        path.replace(/([^\.])+/g, function (term, lc, pos, str) {
            var array = term.match(/([^\[0-9]+){1}(\[)([0-9+])/), last = pos + term.length >= str.length, _getArray = function () {
                return t[array[1]] || (function () {
                        t[array[1]] = [];
                        return t[array[1]];
                    })();
            };
            if (last) {
                // set term = value on current t, creating term as array if necessary.
                if (array) {
                    _getArray()[array[3]] = value;
                }
                else {
                    t[term] = value;
                }
            }
            else {
                // set to current t[term], creating t[term] if necessary.
                if (array) {
                    var a_1 = _getArray();
                    t = a_1[array[3]] || (function () {
                            a_1[array[3]] = {};
                            return a_1[array[3]];
                        })();
                }
                else {
                    t = t[term] || (function () {
                            t[term] = {};
                            return t[term];
                        })();
                }
            }
            return "";
        });
        return inObj;
    }
    jsPlumbUtil.replace = replace;
    //
    // chain a list of functions, supplied by [ object, method name, args ], and return on the first
    // one that returns the failValue. if none return the failValue, return the successValue.
    //
    function functionChain(successValue, failValue, fns) {
        for (var i = 0; i < fns.length; i++) {
            var o = fns[i][0][fns[i][1]].apply(fns[i][0], fns[i][2]);
            if (o === failValue) {
                return o;
            }
        }
        return successValue;
    }
    jsPlumbUtil.functionChain = functionChain;
    /**
     *
     * Take the given model and expand out any parameters. 'functionPrefix' is optional, and if present, helps jsplumb figure out what to do if a value is a Function.
     * if you do not provide it (and doNotExpandFunctions is null, or false), jsplumb will run the given values through any functions it finds, and use the function's
     * output as the value in the result. if you do provide the prefix, only functions that are named and have this prefix
     * will be executed; other functions will be passed as values to the output.
     *
     * @param model
     * @param values
     * @param functionPrefix
     * @param doNotExpandFunctions
     * @returns {any}
     */
    function populate(model, values, functionPrefix, doNotExpandFunctions) {
        // for a string, see if it has parameter matches, and if so, try to make the substitutions.
        var getValue = function (fromString) {
            var matches = fromString.match(/(\${.*?})/g);
            if (matches != null) {
                for (var i = 0; i < matches.length; i++) {
                    var val = values[matches[i].substring(2, matches[i].length - 1)] || "";
                    if (val != null) {
                        fromString = fromString.replace(matches[i], val);
                    }
                }
            }
            return fromString;
        };
        // process one entry.
        var _one = function (d) {
            if (d != null) {
                if (isString(d)) {
                    return getValue(d);
                }
                else if (isFunction(d) && !doNotExpandFunctions && (functionPrefix == null || (d.name || "").indexOf(functionPrefix) === 0)) {
                    return d(values);
                }
                else if (isArray(d)) {
                    var r = [];
                    for (var i = 0; i < d.length; i++) {
                        r.push(_one(d[i]));
                    }
                    return r;
                }
                else if (isObject(d)) {
                    var s = {};
                    for (var j in d) {
                        s[j] = _one(d[j]);
                    }
                    return s;
                }
                else {
                    return d;
                }
            }
        };
        return _one(model);
    }
    jsPlumbUtil.populate = populate;
    function findWithFunction(a, f) {
        if (a) {
            for (var i = 0; i < a.length; i++) {
                if (f(a[i])) {
                    return i;
                }
            }
        }
        return -1;
    }
    jsPlumbUtil.findWithFunction = findWithFunction;
    function removeWithFunction(a, f) {
        var idx = findWithFunction(a, f);
        if (idx > -1) {
            a.splice(idx, 1);
        }
        return idx !== -1;
    }
    jsPlumbUtil.removeWithFunction = removeWithFunction;
    function remove(l, v) {
        var idx = l.indexOf(v);
        if (idx > -1) {
            l.splice(idx, 1);
        }
        return idx !== -1;
    }
    jsPlumbUtil.remove = remove;
    function addWithFunction(list, item, hashFunction) {
        if (findWithFunction(list, hashFunction) === -1) {
            list.push(item);
        }
    }
    jsPlumbUtil.addWithFunction = addWithFunction;
    function addToList(map, key, value, insertAtStart) {
        var l = map[key];
        if (l == null) {
            l = [];
            map[key] = l;
        }
        l[insertAtStart ? "unshift" : "push"](value);
        return l;
    }
    jsPlumbUtil.addToList = addToList;
    function suggest(list, item, insertAtHead) {
        if (list.indexOf(item) === -1) {
            if (insertAtHead) {
                list.unshift(item);
            }
            else {
                list.push(item);
            }
            return true;
        }
        return false;
    }
    jsPlumbUtil.suggest = suggest;
    //
    // extends the given obj (which can be an array) with the given constructor function, prototype functions, and
    // class members, any of which may be null.
    //
    function extend(child, parent, _protoFn) {
        var i;
        parent = isArray(parent) ? parent : [parent];
        var _copyProtoChain = function (focus) {
            var proto = focus.__proto__;
            while (proto != null) {
                if (proto.prototype != null) {
                    for (var j in proto.prototype) {
                        if (proto.prototype.hasOwnProperty(j) && !child.prototype.hasOwnProperty(j)) {
                            child.prototype[j] = proto.prototype[j];
                        }
                    }
                    proto = proto.prototype.__proto__;
                }
                else {
                    proto = null;
                }
            }
        };
        for (i = 0; i < parent.length; i++) {
            for (var j in parent[i].prototype) {
                if (parent[i].prototype.hasOwnProperty(j) && !child.prototype.hasOwnProperty(j)) {
                    child.prototype[j] = parent[i].prototype[j];
                }
            }
            _copyProtoChain(parent[i]);
        }
        var _makeFn = function (name, protoFn) {
            return function () {
                for (i = 0; i < parent.length; i++) {
                    if (parent[i].prototype[name]) {
                        parent[i].prototype[name].apply(this, arguments);
                    }
                }
                return protoFn.apply(this, arguments);
            };
        };
        var _oneSet = function (fns) {
            for (var k in fns) {
                child.prototype[k] = _makeFn(k, fns[k]);
            }
        };
        if (arguments.length > 2) {
            for (i = 2; i < arguments.length; i++) {
                _oneSet(arguments[i]);
            }
        }
        return child;
    }
    jsPlumbUtil.extend = extend;
    function uuid() {
        return ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        }));
    }
    jsPlumbUtil.uuid = uuid;
    function fastTrim(s) {
        if (s == null) {
            return null;
        }
        var str = s.replace(/^\s\s*/, ''), ws = /\s/, i = str.length;
        while (ws.test(str.charAt(--i))) {
        }
        return str.slice(0, i + 1);
    }
    jsPlumbUtil.fastTrim = fastTrim;
    function each(obj, fn) {
        obj = obj.length == null || typeof obj === "string" ? [obj] : obj;
        for (var i = 0; i < obj.length; i++) {
            fn(obj[i]);
        }
    }
    jsPlumbUtil.each = each;
    function map(obj, fn) {
        var o = [];
        for (var i = 0; i < obj.length; i++) {
            o.push(fn(obj[i]));
        }
        return o;
    }
    jsPlumbUtil.map = map;
    function mergeWithParents(type, map, parentAttribute) {
        parentAttribute = parentAttribute || "parent";
        var _def = function (id) {
            return id ? map[id] : null;
        };
        var _parent = function (def) {
            return def ? _def(def[parentAttribute]) : null;
        };
        var _one = function (parent, def) {
            if (parent == null) {
                return def;
            }
            else {
                var d_1 = merge(parent, def);
                return _one(_parent(parent), d_1);
            }
        };
        var _getDef = function (t) {
            if (t == null) {
                return {};
            }
            if (typeof t === "string") {
                return _def(t);
            }
            else if (t.length) {
                var done = false, i = 0, _dd = void 0;
                while (!done && i < t.length) {
                    _dd = _getDef(t[i]);
                    if (_dd) {
                        done = true;
                    }
                    else {
                        i++;
                    }
                }
                return _dd;
            }
        };
        var d = _getDef(type);
        if (d) {
            return _one(_parent(d), d);
        }
        else {
            return {};
        }
    }
    jsPlumbUtil.mergeWithParents = mergeWithParents;
    jsPlumbUtil.logEnabled = true;
    function log() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (jsPlumbUtil.logEnabled && typeof console !== "undefined") {
            try {
                var msg = arguments[arguments.length - 1];
                console.log(msg);
            }
            catch (e) {
            }
        }
    }
    jsPlumbUtil.log = log;
    /**
     * Wraps one function with another, creating a placeholder for the
     * wrapped function if it was null. this is used to wrap the various
     * drag/drop event functions - to allow jsPlumb to be notified of
     * important lifecycle events without imposing itself on the user's
     * drag/drop functionality.
     * @method jsPlumbUtil.wrap
     * @param {Function} wrappedFunction original function to wrap; may be null.
     * @param {Function} newFunction function to wrap the original with.
     * @param {Object} [returnOnThisValue] Optional. Indicates that the wrappedFunction should
     * not be executed if the newFunction returns a value matching 'returnOnThisValue'.
     * note that this is a simple comparison and only works for primitives right now.
     */
    function wrap(wrappedFunction, newFunction, returnOnThisValue) {
        return function () {
            var r = null;
            try {
                if (newFunction != null) {
                    r = newFunction.apply(this, arguments);
                }
            }
            catch (e) {
                log("jsPlumb function failed : " + e);
            }
            if ((wrappedFunction != null) && (returnOnThisValue == null || (r !== returnOnThisValue))) {
                try {
                    r = wrappedFunction.apply(this, arguments);
                }
                catch (e) {
                    log("wrapped function failed : " + e);
                }
            }
            return r;
        };
    }
    jsPlumbUtil.wrap = wrap;
    var EventGenerator = /** @class */ (function () {
        function EventGenerator() {
            var _this = this;
            this._listeners = {};
            this.eventsSuspended = false;
            this.tick = false;
            // this is a list of events that should re-throw any errors that occur during their dispatch.
            this.eventsToDieOn = { "ready": true };
            this.queue = [];
            this.bind = function (event, listener, insertAtStart) {
                var _one = function (evt) {
                    addToList(_this._listeners, evt, listener, insertAtStart);
                    listener.__jsPlumb = listener.__jsPlumb || {};
                    listener.__jsPlumb[uuid()] = evt;
                };
                if (typeof event === "string") {
                    _one(event);
                }
                else if (event.length != null) {
                    for (var i = 0; i < event.length; i++) {
                        _one(event[i]);
                    }
                }
                return _this;
            };
            this.fire = function (event, value, originalEvent) {
                if (!this.tick) {
                    this.tick = true;
                    if (!this.eventsSuspended && this._listeners[event]) {
                        var l = this._listeners[event].length, i = 0, _gone = false, ret = null;
                        if (!this.shouldFireEvent || this.shouldFireEvent(event, value, originalEvent)) {
                            while (!_gone && i < l && ret !== false) {
                                // doing it this way rather than catching and then possibly re-throwing means that an error propagated by this
                                // method will have the whole call stack available in the debugger.
                                if (this.eventsToDieOn[event]) {
                                    this._listeners[event][i].apply(this, [value, originalEvent]);
                                }
                                else {
                                    try {
                                        ret = this._listeners[event][i].apply(this, [value, originalEvent]);
                                    }
                                    catch (e) {
                                        log("jsPlumb: fire failed for event " + event + " : " + e);
                                    }
                                }
                                i++;
                                if (this._listeners == null || this._listeners[event] == null) {
                                    _gone = true;
                                }
                            }
                        }
                    }
                    this.tick = false;
                    this._drain();
                }
                else {
                    this.queue.unshift(arguments);
                }
                return this;
            };
            this._drain = function () {
                var n = _this.queue.pop();
                if (n) {
                    _this.fire.apply(_this, n);
                }
            };
            this.unbind = function (eventOrListener, listener) {
                if (arguments.length === 0) {
                    this._listeners = {};
                }
                else if (arguments.length === 1) {
                    if (typeof eventOrListener === "string") {
                        delete this._listeners[eventOrListener];
                    }
                    else if (eventOrListener.__jsPlumb) {
                        var evt = void 0;
                        for (var i in eventOrListener.__jsPlumb) {
                            evt = eventOrListener.__jsPlumb[i];
                            remove(this._listeners[evt] || [], eventOrListener);
                        }
                    }
                }
                else if (arguments.length === 2) {
                    remove(this._listeners[eventOrListener] || [], listener);
                }
                return this;
            };
            this.getListener = function (forEvent) {
                return _this._listeners[forEvent];
            };
            this.setSuspendEvents = function (val) {
                _this.eventsSuspended = val;
            };
            this.isSuspendEvents = function () {
                return _this.eventsSuspended;
            };
            this.silently = function (fn) {
                _this.setSuspendEvents(true);
                try {
                    fn();
                }
                catch (e) {
                    log("Cannot execute silent function " + e);
                }
                _this.setSuspendEvents(false);
            };
            this.cleanupListeners = function () {
                for (var i in _this._listeners) {
                    _this._listeners[i] = null;
                }
            };
        }
        return EventGenerator;
    }());
    jsPlumbUtil.EventGenerator = EventGenerator;

}).call(typeof window !== 'undefined' ? window : this);
/*
 * This file contains utility functions that run in browsers only.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
 ;(function() {

  "use strict";

   var root = this;

    root.jsPlumbUtil.matchesSelector = function(el, selector, ctx) {
       ctx = ctx || el.parentNode;
       var possibles = ctx.querySelectorAll(selector);
       for (var i = 0; i < possibles.length; i++) {
           if (possibles[i] === el) {
               return true;
           }
       }
       return false;
   };

    root.jsPlumbUtil.consume = function(e, doNotPreventDefault) {
       if (e.stopPropagation) {
           e.stopPropagation();
       }
       else {
           e.returnValue = false;
       }

       if (!doNotPreventDefault && e.preventDefault){
           e.preventDefault();
       }
   };

   /*
    * Function: sizeElement
    * Helper to size and position an element. You would typically use
    * this when writing your own Connector or Endpoint implementation.
    *
    * Parameters:
    *  x - [int] x position for the element origin
    *  y - [int] y position for the element origin
    *  w - [int] width of the element
    *  h - [int] height of the element
    *
    */
    root.jsPlumbUtil.sizeElement = function(el, x, y, w, h) {
       if (el) {
           el.style.height = h + "px";
           el.height = h;
           el.style.width = w + "px";
           el.width = w;
           el.style.left = x + "px";
           el.style.top = y + "px";
       }
   };

 }).call(typeof window !== 'undefined' ? window : this);

/*
 * This file contains the core code.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;(function () {

    "use strict";

    var root = this;

    var _ju = root.jsPlumbUtil,

        /**
         * creates a timestamp, using milliseconds since 1970, but as a string.
         */
        _timestamp = function () {
            return "" + (new Date()).getTime();
        },

        // helper method to update the hover style whenever it, or paintStyle, changes.
        // we use paintStyle as the foundation and merge hoverPaintStyle over the
        // top.
        _updateHoverStyle = function (component) {
            if (component._jsPlumb.paintStyle && component._jsPlumb.hoverPaintStyle) {
                var mergedHoverStyle = {};
                jsPlumb.extend(mergedHoverStyle, component._jsPlumb.paintStyle);
                jsPlumb.extend(mergedHoverStyle, component._jsPlumb.hoverPaintStyle);
                delete component._jsPlumb.hoverPaintStyle;
                // we want the fill of paintStyle to override a gradient, if possible.
                if (mergedHoverStyle.gradient && component._jsPlumb.paintStyle.fill) {
                    delete mergedHoverStyle.gradient;
                }
                component._jsPlumb.hoverPaintStyle = mergedHoverStyle;
            }
        },
        events = ["tap", "dbltap", "click", "dblclick", "mouseover", "mouseout", "mousemove", "mousedown", "mouseup", "contextmenu" ],
        eventFilters = { "mouseout": "mouseleave", "mouseexit": "mouseleave" },
        _updateAttachedElements = function (component, state, timestamp, sourceElement) {
            var affectedElements = component.getAttachedElements();
            if (affectedElements) {
                for (var i = 0, j = affectedElements.length; i < j; i++) {
                    if (!sourceElement || sourceElement !== affectedElements[i]) {
                        affectedElements[i].setHover(state, true, timestamp);			// tell the attached elements not to inform their own attached elements.
                    }
                }
            }
        },
        _splitType = function (t) {
            return t == null ? null : t.split(" ");
        },
        _mapType = function(map, obj, typeId) {
            for (var i in obj) {
                map[i] = typeId;
            }
        },
        _each = function(fn, obj) {
            obj = _ju.isArray(obj) || (obj.length != null && !_ju.isString(obj)) ? obj : [ obj ];
            for (var i = 0; i < obj.length; i++) {
                try {
                    fn.apply(obj[i], [ obj[i] ]);
                }
                catch (e) {
                    _ju.log(".each iteration failed : " + e);
                }
            }
        },
        _applyTypes = function (component, params, doNotRepaint) {
            if (component.getDefaultType) {
                var td = component.getTypeDescriptor(), map = {};
                var defType = component.getDefaultType();
                var o = _ju.merge({}, defType);
                _mapType(map, defType, "__default");
                for (var i = 0, j = component._jsPlumb.types.length; i < j; i++) {
                    var tid = component._jsPlumb.types[i];
                    if (tid !== "__default") {
                        var _t = component._jsPlumb.instance.getType(tid, td);
                        if (_t != null) {
                            o = _ju.merge(o, _t, [ "cssClass" ], [ "connector" ]);
                            _mapType(map, _t, tid);
                        }
                    }
                }

                if (params) {
                    o = _ju.populate(o, params, "_");
                }

                component.applyType(o, doNotRepaint, map);
                if (!doNotRepaint) {
                    component.repaint();
                }
            }
        },

// ------------------------------ BEGIN jsPlumbUIComponent --------------------------------------------

        jsPlumbUIComponent = root.jsPlumbUIComponent = function (params) {

            _ju.EventGenerator.apply(this, arguments);

            var self = this,
                a = arguments,
                idPrefix = self.idPrefix,
                id = idPrefix + (new Date()).getTime();

            this._jsPlumb = {
                instance: params._jsPlumb,
                parameters: params.parameters || {},
                paintStyle: null,
                hoverPaintStyle: null,
                paintStyleInUse: null,
                hover: false,
                beforeDetach: params.beforeDetach,
                beforeDrop: params.beforeDrop,
                overlayPlacements: [],
                hoverClass: params.hoverClass || params._jsPlumb.Defaults.HoverClass,
                types: [],
                typeCache:{}
            };

            this.cacheTypeItem = function(key, item, typeId) {
                this._jsPlumb.typeCache[typeId] = this._jsPlumb.typeCache[typeId] || {};
                this._jsPlumb.typeCache[typeId][key] = item;
            };
            this.getCachedTypeItem = function(key, typeId) {
                return this._jsPlumb.typeCache[typeId] ? this._jsPlumb.typeCache[typeId][key] : null;
            };

            this.getId = function () {
                return id;
            };

// ----------------------------- default type --------------------------------------------


            var o = params.overlays || [], oo = {};
            if (this.defaultOverlayKeys) {
                for (var i = 0; i < this.defaultOverlayKeys.length; i++) {
                    Array.prototype.push.apply(o, this._jsPlumb.instance.Defaults[this.defaultOverlayKeys[i]] || []);
                }

                for (i = 0; i < o.length; i++) {
                    // if a string, convert to object representation so that we can store the typeid on it.
                    // also assign an id.
                    var fo = jsPlumb.convertToFullOverlaySpec(o[i]);
                    oo[fo[1].id] = fo;
                }
            }

            var _defaultType = {
                overlays:oo,
                parameters: params.parameters || {},
                scope: params.scope || this._jsPlumb.instance.getDefaultScope()
            };
            this.getDefaultType = function() {
                return _defaultType;
            };
            this.appendToDefaultType = function(obj) {
                for (var i in obj) {
                    _defaultType[i] = obj[i];
                }
            };

// ----------------------------- end default type --------------------------------------------

            // all components can generate events

            if (params.events) {
                for (var evtName in params.events) {
                    self.bind(evtName, params.events[evtName]);
                }
            }

            // all components get this clone function.
            // TODO issue 116 showed a problem with this - it seems 'a' that is in
            // the clone function's scope is shared by all invocations of it, the classic
            // JS closure problem.  for now, jsPlumb does a version of this inline where
            // it used to call clone.  but it would be nice to find some time to look
            // further at this.
            this.clone = function () {
                var o = Object.create(this.constructor.prototype);
                this.constructor.apply(o, a);
                return o;
            }.bind(this);

            // user can supply a beforeDetach callback, which will be executed before a detach
            // is performed; returning false prevents the detach.
            this.isDetachAllowed = function (connection) {
                var r = true;
                if (this._jsPlumb.beforeDetach) {
                    try {
                        r = this._jsPlumb.beforeDetach(connection);
                    }
                    catch (e) {
                        _ju.log("jsPlumb: beforeDetach callback failed", e);
                    }
                }
                return r;
            };

            // user can supply a beforeDrop callback, which will be executed before a dropped
            // connection is confirmed. user can return false to reject connection.
            this.isDropAllowed = function (sourceId, targetId, scope, connection, dropEndpoint, source, target) {
                var r = this._jsPlumb.instance.checkCondition("beforeDrop", {
                    sourceId: sourceId,
                    targetId: targetId,
                    scope: scope,
                    connection: connection,
                    dropEndpoint: dropEndpoint,
                    source: source, target: target
                });
                if (this._jsPlumb.beforeDrop) {
                    try {
                        r = this._jsPlumb.beforeDrop({
                            sourceId: sourceId,
                            targetId: targetId,
                            scope: scope,
                            connection: connection,
                            dropEndpoint: dropEndpoint,
                            source: source, target: target
                        });
                    }
                    catch (e) {
                        _ju.log("jsPlumb: beforeDrop callback failed", e);
                    }
                }
                return r;
            };

            var domListeners = [];

            // sets the component associated with listener events. for instance, an overlay delegates
            // its events back to a connector. but if the connector is swapped on the underlying connection,
            // then this component must be changed. This is called by setConnector in the Connection class.
            this.setListenerComponent = function (c) {
                for (var i = 0; i < domListeners.length; i++) {
                    domListeners[i][3] = c;
                }
            };


        };

    var _removeTypeCssHelper = function (component, typeIndex) {
        var typeId = component._jsPlumb.types[typeIndex],
            type = component._jsPlumb.instance.getType(typeId, component.getTypeDescriptor());

        if (type != null && type.cssClass && component.canvas) {
            component._jsPlumb.instance.removeClass(component.canvas, type.cssClass);
        }
    };

    _ju.extend(root.jsPlumbUIComponent, _ju.EventGenerator, {

        getParameter: function (name) {
            return this._jsPlumb.parameters[name];
        },

        setParameter: function (name, value) {
            this._jsPlumb.parameters[name] = value;
        },

        getParameters: function () {
            return this._jsPlumb.parameters;
        },

        setParameters: function (p) {
            this._jsPlumb.parameters = p;
        },

        getClass:function() {
            return jsPlumb.getClass(this.canvas);
        },

        hasClass:function(clazz) {
            return jsPlumb.hasClass(this.canvas, clazz);
        },

        addClass: function (clazz) {
            jsPlumb.addClass(this.canvas, clazz);
        },

        removeClass: function (clazz) {
            jsPlumb.removeClass(this.canvas, clazz);
        },

        updateClasses: function (classesToAdd, classesToRemove) {
            jsPlumb.updateClasses(this.canvas, classesToAdd, classesToRemove);
        },

        setType: function (typeId, params, doNotRepaint) {
            this.clearTypes();
            this._jsPlumb.types = _splitType(typeId) || [];
            _applyTypes(this, params, doNotRepaint);
        },

        getType: function () {
            return this._jsPlumb.types;
        },

        reapplyTypes: function (params, doNotRepaint) {
            _applyTypes(this, params, doNotRepaint);
        },

        hasType: function (typeId) {
            return this._jsPlumb.types.indexOf(typeId) !== -1;
        },

        addType: function (typeId, params, doNotRepaint) {
            var t = _splitType(typeId), _cont = false;
            if (t != null) {
                for (var i = 0, j = t.length; i < j; i++) {
                    if (!this.hasType(t[i])) {
                        this._jsPlumb.types.push(t[i]);
                        _cont = true;
                    }
                }
                if (_cont) {
                    _applyTypes(this, params, doNotRepaint);
                }
            }
        },

        removeType: function (typeId, params, doNotRepaint) {
            var t = _splitType(typeId), _cont = false, _one = function (tt) {
                var idx = this._jsPlumb.types.indexOf(tt);
                if (idx !== -1) {
                    // remove css class if necessary
                    _removeTypeCssHelper(this, idx);
                    this._jsPlumb.types.splice(idx, 1);
                    return true;
                }
                return false;
            }.bind(this);

            if (t != null) {
                for (var i = 0, j = t.length; i < j; i++) {
                    _cont = _one(t[i]) || _cont;
                }
                if (_cont) {
                    _applyTypes(this, params, doNotRepaint);
                }
            }
        },
        clearTypes: function (params, doNotRepaint) {
            var i = this._jsPlumb.types.length;
            for (var j = 0; j < i; j++) {
                _removeTypeCssHelper(this, 0);
                this._jsPlumb.types.splice(0, 1);
            }
            _applyTypes(this, params, doNotRepaint);
        },

        toggleType: function (typeId, params, doNotRepaint) {
            var t = _splitType(typeId);
            if (t != null) {
                for (var i = 0, j = t.length; i < j; i++) {
                    var idx = this._jsPlumb.types.indexOf(t[i]);
                    if (idx !== -1) {
                        _removeTypeCssHelper(this, idx);
                        this._jsPlumb.types.splice(idx, 1);
                    }
                    else {
                        this._jsPlumb.types.push(t[i]);
                    }
                }

                _applyTypes(this, params, doNotRepaint);
            }
        },
        applyType: function (t, doNotRepaint) {
            this.setPaintStyle(t.paintStyle, doNotRepaint);
            this.setHoverPaintStyle(t.hoverPaintStyle, doNotRepaint);
            if (t.parameters) {
                for (var i in t.parameters) {
                    this.setParameter(i, t.parameters[i]);
                }
            }
            this._jsPlumb.paintStyleInUse = this.getPaintStyle();
        },
        setPaintStyle: function (style, doNotRepaint) {
            // this._jsPlumb.paintStyle = jsPlumb.extend({}, style);
            // TODO figure out if we want components to clone paintStyle so as not to share it.
            this._jsPlumb.paintStyle = style;
            this._jsPlumb.paintStyleInUse = this._jsPlumb.paintStyle;
            _updateHoverStyle(this);
            if (!doNotRepaint) {
                this.repaint();
            }
        },
        getPaintStyle: function () {
            return this._jsPlumb.paintStyle;
        },
        setHoverPaintStyle: function (style, doNotRepaint) {
            //this._jsPlumb.hoverPaintStyle = jsPlumb.extend({}, style);
            // TODO figure out if we want components to clone paintStyle so as not to share it.
            this._jsPlumb.hoverPaintStyle = style;
            _updateHoverStyle(this);
            if (!doNotRepaint) {
                this.repaint();
            }
        },
        getHoverPaintStyle: function () {
            return this._jsPlumb.hoverPaintStyle;
        },
        destroy: function (force) {
            if (force || this.typeId == null) {
                this.cleanupListeners(); // this is on EventGenerator
                this.clone = null;
                this._jsPlumb = null;
            }
        },

        isHover: function () {
            return this._jsPlumb.hover;
        },

        setHover: function (hover, ignoreAttachedElements, timestamp) {
            // while dragging, we ignore these events.  this keeps the UI from flashing and
            // swishing and whatevering.
            if (this._jsPlumb && !this._jsPlumb.instance.currentlyDragging && !this._jsPlumb.instance.isHoverSuspended()) {

                this._jsPlumb.hover = hover;
                var method = hover ? "addClass" : "removeClass";

                if (this.canvas != null) {
                    if (this._jsPlumb.instance.hoverClass != null) {
                        this._jsPlumb.instance[method](this.canvas, this._jsPlumb.instance.hoverClass);
                    }
                    if (this._jsPlumb.hoverClass != null) {
                        this._jsPlumb.instance[method](this.canvas, this._jsPlumb.hoverClass);
                    }
                }
                if (this._jsPlumb.hoverPaintStyle != null) {
                    this._jsPlumb.paintStyleInUse = hover ? this._jsPlumb.hoverPaintStyle : this._jsPlumb.paintStyle;
                    if (!this._jsPlumb.instance.isSuspendDrawing()) {
                        timestamp = timestamp || _timestamp();
                        this.repaint({timestamp: timestamp, recalc: false});
                    }
                }
                // get the list of other affected elements, if supported by this component.
                // for a connection, its the endpoints.  for an endpoint, its the connections! surprise.
                if (this.getAttachedElements && !ignoreAttachedElements) {
                    _updateAttachedElements(this, hover, _timestamp(), this);
                }
            }
        }
    });

// ------------------------------ END jsPlumbUIComponent --------------------------------------------

    var _jsPlumbInstanceIndex = 0,
        getInstanceIndex = function () {
            var i = _jsPlumbInstanceIndex + 1;
            _jsPlumbInstanceIndex++;
            return i;
        };

    var jsPlumbInstance = root.jsPlumbInstance = function (_defaults) {

        this.version = "2.9.3";

        this.Defaults = {
            Anchor: "Bottom",
            Anchors: [ null, null ],
            ConnectionsDetachable: true,
            ConnectionOverlays: [ ],
            Connector: "Bezier",
            Container: null,
            DoNotThrowErrors: false,
            DragOptions: { },
            DropOptions: { },
            Endpoint: "Dot",
            EndpointOverlays: [ ],
            Endpoints: [ null, null ],
            EndpointStyle: { fill: "#456" },
            EndpointStyles: [ null, null ],
            EndpointHoverStyle: null,
            EndpointHoverStyles: [ null, null ],
            HoverPaintStyle: null,
            LabelStyle: { color: "black" },
            LogEnabled: false,
            Overlays: [ ],
            MaxConnections: 1,
            PaintStyle: { "stroke-width": 4, stroke: "#456" },
            ReattachConnections: false,
            RenderMode: "svg",
            Scope: "jsPlumb_DefaultScope"
        };

        if (_defaults) {
            jsPlumb.extend(this.Defaults, _defaults);
        }

        this.logEnabled = this.Defaults.LogEnabled;
        this._connectionTypes = {};
        this._endpointTypes = {};

        _ju.EventGenerator.apply(this);

        var _currentInstance = this,
            _instanceIndex = getInstanceIndex(),
            _bb = _currentInstance.bind,
            _initialDefaults = {},
            _zoom = 1,
            _info = function (el) {
                if (el == null) {
                    return null;
                }
                else if (el.nodeType === 3 || el.nodeType === 8) {
                    return { el:el, text:true };
                }
                else {
                    var _el = _currentInstance.getElement(el);
                    return { el: _el, id: (_ju.isString(el) && _el == null) ? el : _getId(_el) };
                }
            };

        this.getInstanceIndex = function () {
            return _instanceIndex;
        };

        // CONVERTED
        this.setZoom = function (z, repaintEverything) {
            _zoom = z;
            _currentInstance.fire("zoom", _zoom);
            if (repaintEverything) {
                _currentInstance.repaintEverything();
            }
            return true;
        };
        // CONVERTED
        this.getZoom = function () {
            return _zoom;
        };

        for (var i in this.Defaults) {
            _initialDefaults[i] = this.Defaults[i];
        }

        var _container, _containerDelegations = [];
        this.unbindContainer = function() {
            if (_container != null && _containerDelegations.length > 0) {
                for (var i = 0; i < _containerDelegations.length; i++) {
                    _currentInstance.off(_container, _containerDelegations[i][0], _containerDelegations[i][1]);
                }
            }
        };
        this.setContainer = function (c) {

            this.unbindContainer();

            // get container as dom element.
            c = this.getElement(c);
            // move existing connections and endpoints, if any.
            this.select().each(function (conn) {
                conn.moveParent(c);
            });
            this.selectEndpoints().each(function (ep) {
                ep.moveParent(c);
            });

            // set container.
            var previousContainer = _container;
            _container = c;
            _containerDelegations.length = 0;
            var eventAliases = {
                "endpointclick":"endpointClick",
                "endpointdblclick":"endpointDblClick"
            };

            var _oneDelegateHandler = function (id, e, componentType) {
                var t = e.srcElement || e.target,
                    jp = (t && t.parentNode ? t.parentNode._jsPlumb : null) || (t ? t._jsPlumb : null) || (t && t.parentNode && t.parentNode.parentNode ? t.parentNode.parentNode._jsPlumb : null);
                if (jp) {
                    jp.fire(id, jp, e);
                    var alias = componentType ? eventAliases[componentType + id] || id : id;
                    // jsplumb also fires every event coming from components/overlays. That's what the test for `jp.component` is for.
                    _currentInstance.fire(alias, jp.component || jp, e);
                }
            };

            var _addOneDelegate = function(eventId, selector, fn) {
                _containerDelegations.push([eventId, fn]);
                _currentInstance.on(_container, eventId, selector, fn);
            };

            // delegate one event on the container to jsplumb elements. it might be possible to
            // abstract this out: each of endpoint, connection and overlay could register themselves with
            // jsplumb as "component types" or whatever, and provide a suitable selector. this would be
            // done by the renderer (although admittedly from 2.0 onwards we're not supporting vml anymore)
            var _oneDelegate = function (id) {
                // connections.
                _addOneDelegate(id, ".jtk-connector", function (e) {
                    _oneDelegateHandler(id, e);
                });
                // endpoints. note they can have an enclosing div, or not.
                _addOneDelegate(id, ".jtk-endpoint", function (e) {
                    _oneDelegateHandler(id, e, "endpoint");
                });
                // overlays
                _addOneDelegate(id, ".jtk-overlay", function (e) {
                    _oneDelegateHandler(id, e);
                });
            };

            for (var i = 0; i < events.length; i++) {
                _oneDelegate(events[i]);
            }

            // managed elements
            for (var elId in managedElements) {
                var el = managedElements[elId].el;
                if (el.parentNode === previousContainer) {
                    previousContainer.removeChild(el);
                    _container.appendChild(el);
                }
            }

        };
        this.getContainer = function () {
            return _container;
        };

        this.bind = function (event, fn) {
            if ("ready" === event && initialized) {
                fn();
            }
            else {
                _bb.apply(_currentInstance, [event, fn]);
            }
        };

        _currentInstance.importDefaults = function (d) {
            for (var i in d) {
                _currentInstance.Defaults[i] = d[i];
            }
            if (d.Container) {
                _currentInstance.setContainer(d.Container);
            }

            return _currentInstance;
        };

        _currentInstance.restoreDefaults = function () {
            _currentInstance.Defaults = jsPlumb.extend({}, _initialDefaults);
            return _currentInstance;
        };

        var log = null,
            initialized = false,
            // TODO remove from window scope
            connections = [],
            // map of element id -> endpoint lists. an element can have an arbitrary
            // number of endpoints on it, and not all of them have to be connected
            // to anything.
            endpointsByElement = {},
            endpointsByUUID = {},
            managedElements = {},
            offsets = {},
            offsetTimestamps = {},
            draggableStates = {},
            connectionBeingDragged = false,
            sizes = [],
            _suspendDrawing = false,
            _suspendedAt = null,
            DEFAULT_SCOPE = this.Defaults.Scope,
            _curIdStamp = 1,
            _idstamp = function () {
                return "" + _curIdStamp++;
            },

            //
            // appends an element to some other element, which is calculated as follows:
            //
            // 1. if Container exists, use that element.
            // 2. if the 'parent' parameter exists, use that.
            // 3. otherwise just use the root element.
            //
            //
            _appendElement = function (el, parent) {
                if (_container) {
                    _container.appendChild(el);
                }
                else if (!parent) {
                    this.appendToRoot(el);
                }
                else {
                    this.getElement(parent).appendChild(el);
                }
            }.bind(this),

            //
            // Draws an endpoint and its connections. this is the main entry point into drawing connections as well
            // as endpoints, since jsPlumb is endpoint-centric under the hood.
            //
            // @param element element to draw (of type library specific element object)
            // @param ui UI object from current library's event system. optional.
            // @param timestamp timestamp for this paint cycle. used to speed things up a little by cutting down the amount of offset calculations we do.
            // @param clearEdits defaults to false; indicates that mouse edits for connectors should be cleared
            ///
            _draw = function (element, ui, timestamp, clearEdits) {

                if (!_suspendDrawing) {
                    var id = _getId(element),
                        repaintEls,
                        dm = _currentInstance.getDragManager();

                    if (dm) {
                        repaintEls = dm.getElementsForDraggable(id);
                    }

                    if (timestamp == null) {
                        timestamp = _timestamp();
                    }

                    // update the offset of everything _before_ we try to draw anything.
                    var o = _updateOffset({ elId: id, offset: ui, recalc: false, timestamp: timestamp });

                    if (repaintEls && o && o.o) {
                        for (var i in repaintEls) {
                            _updateOffset({
                                elId: repaintEls[i].id,
                                offset: {
                                    left: o.o.left + repaintEls[i].offset.left,
                                    top: o.o.top + repaintEls[i].offset.top
                                },
                                recalc: false,
                                timestamp: timestamp
                            });
                        }
                    }

                    _currentInstance.anchorManager.redraw(id, ui, timestamp, null, clearEdits);

                    if (repaintEls) {
                        for (var j in repaintEls) {
                            _currentInstance.anchorManager.redraw(repaintEls[j].id, ui, timestamp, repaintEls[j].offset, clearEdits, true);
                        }
                    }
                }
            },

            //
            // gets an Endpoint by uuid.
            //
            _getEndpoint = function (uuid) {
                return endpointsByUUID[uuid];
            },

            /**
             * inits a draggable if it's not already initialised.
             * TODO: somehow abstract this to the adapter, because the concept of "draggable" has no
             * place on the server.
             */


            _scopeMatch = function (e1, e2) {
                var s1 = e1.scope.split(/\s/), s2 = e2.scope.split(/\s/);
                for (var i = 0; i < s1.length; i++) {
                    for (var j = 0; j < s2.length; j++) {
                        if (s2[j] === s1[i]) {
                            return true;
                        }
                    }
                }

                return false;
            },

            _mergeOverrides = function (def, values) {
                var m = jsPlumb.extend({}, def);
                for (var i in values) {
                    if (values[i]) {
                        m[i] = values[i];
                    }
                }
                return m;
            },

            /*
             * prepares a final params object that can be passed to _newConnection, taking into account defaults, events, etc.
             */
            _prepareConnectionParams = function (params, referenceParams) {
                var _p = jsPlumb.extend({ }, params);
                if (referenceParams) {
                    jsPlumb.extend(_p, referenceParams);
                }

                // hotwire endpoints passed as source or target to sourceEndpoint/targetEndpoint, respectively.
                if (_p.source) {
                    if (_p.source.endpoint) {
                        _p.sourceEndpoint = _p.source;
                    }
                    else {
                        _p.source = _currentInstance.getElement(_p.source);
                    }
                }
                if (_p.target) {
                    if (_p.target.endpoint) {
                        _p.targetEndpoint = _p.target;
                    }
                    else {
                        _p.target = _currentInstance.getElement(_p.target);
                    }
                }

                // test for endpoint uuids to connect
                if (params.uuids) {
                    _p.sourceEndpoint = _getEndpoint(params.uuids[0]);
                    _p.targetEndpoint = _getEndpoint(params.uuids[1]);
                }

                // now ensure that if we do have Endpoints already, they're not full.
                // source:
                if (_p.sourceEndpoint && _p.sourceEndpoint.isFull()) {
                    _ju.log(_currentInstance, "could not add connection; source endpoint is full");
                    return;
                }

                // target:
                if (_p.targetEndpoint && _p.targetEndpoint.isFull()) {
                    _ju.log(_currentInstance, "could not add connection; target endpoint is full");
                    return;
                }

                // if source endpoint mandates connection type and nothing specified in our params, use it.
                if (!_p.type && _p.sourceEndpoint) {
                    _p.type = _p.sourceEndpoint.connectionType;
                }

                // copy in any connectorOverlays that were specified on the source endpoint.
                // it doesnt copy target endpoint overlays.  i'm not sure if we want it to or not.
                if (_p.sourceEndpoint && _p.sourceEndpoint.connectorOverlays) {
                    _p.overlays = _p.overlays || [];
                    for (var i = 0, j = _p.sourceEndpoint.connectorOverlays.length; i < j; i++) {
                        _p.overlays.push(_p.sourceEndpoint.connectorOverlays[i]);
                    }
                }

                // scope
                if (_p.sourceEndpoint && _p.sourceEndpoint.scope) {
                    _p.scope = _p.sourceEndpoint.scope;
                }

                // pointer events
                if (!_p["pointer-events"] && _p.sourceEndpoint && _p.sourceEndpoint.connectorPointerEvents) {
                    _p["pointer-events"] = _p.sourceEndpoint.connectorPointerEvents;
                }


                var _addEndpoint = function (el, def, idx) {
                    return _currentInstance.addEndpoint(el, _mergeOverrides(def, {
                        anchor: _p.anchors ? _p.anchors[idx] : _p.anchor,
                        endpoint: _p.endpoints ? _p.endpoints[idx] : _p.endpoint,
                        paintStyle: _p.endpointStyles ? _p.endpointStyles[idx] : _p.endpointStyle,
                        hoverPaintStyle: _p.endpointHoverStyles ? _p.endpointHoverStyles[idx] : _p.endpointHoverStyle
                    }));
                };

                // check for makeSource/makeTarget specs.

                var _oneElementDef = function (type, idx, defs, matchType) {
                    if (_p[type] && !_p[type].endpoint && !_p[type + "Endpoint"] && !_p.newConnection) {
                        var tid = _getId(_p[type]), tep = defs[tid];

                        tep = tep ? tep[matchType] : null;

                        if (tep) {
                            // if not enabled, return.
                            if (!tep.enabled) {
                                return false;
                            }
                            var newEndpoint = tep.endpoint != null && tep.endpoint._jsPlumb ? tep.endpoint : _addEndpoint(_p[type], tep.def, idx);
                            if (newEndpoint.isFull()) {
                                return false;
                            }
                            _p[type + "Endpoint"] = newEndpoint;
                            if (!_p.scope && tep.def.scope) {
                                _p.scope = tep.def.scope;
                            } // provide scope if not already provided and endpoint def has one.
                            if (tep.uniqueEndpoint) {
                                if (!tep.endpoint) {
                                    tep.endpoint = newEndpoint;
                                    newEndpoint.setDeleteOnEmpty(false);
                                }
                                else {
                                    newEndpoint.finalEndpoint = tep.endpoint;
                                }
                            } else {
                                newEndpoint.setDeleteOnEmpty(true);
                            }

                            //
                            // copy in connector overlays if present on the source definition.
                            //
                            if (idx === 0 && tep.def.connectorOverlays) {
                                _p.overlays = _p.overlays || [];
                                Array.prototype.push.apply(_p.overlays, tep.def.connectorOverlays);
                            }
                        }
                    }
                };

                if (_oneElementDef("source", 0, this.sourceEndpointDefinitions, _p.type || "default") === false) {
                    return;
                }
                if (_oneElementDef("target", 1, this.targetEndpointDefinitions, _p.type || "default") === false) {
                    return;
                }

                // last, ensure scopes match
                if (_p.sourceEndpoint && _p.targetEndpoint) {
                    if (!_scopeMatch(_p.sourceEndpoint, _p.targetEndpoint)) {
                        _p = null;
                    }
                }

                return _p;
            }.bind(_currentInstance),

            _newConnection = function (params) {
                var connectionFunc = _currentInstance.Defaults.ConnectionType || _currentInstance.getDefaultConnectionType();

                params._jsPlumb = _currentInstance;
                params.newConnection = _newConnection;
                params.newEndpoint = _newEndpoint;
                params.endpointsByUUID = endpointsByUUID;
                params.endpointsByElement = endpointsByElement;
                params.finaliseConnection = _finaliseConnection;
                params.id = "con_" + _idstamp();
                var con = new connectionFunc(params);

                // if the connection is draggable, then maybe we need to tell the target endpoint to init the
                // dragging code. it won't run again if it already configured to be draggable.
                if (con.isDetachable()) {
                    con.endpoints[0].initDraggable("_jsPlumbSource");
                    con.endpoints[1].initDraggable("_jsPlumbTarget");
                }

                return con;
            },

            //
            // adds the connection to the backing model, fires an event if necessary and then redraws
            //
            _finaliseConnection = _currentInstance.finaliseConnection = function (jpc, params, originalEvent, doInformAnchorManager) {
                params = params || {};
                // add to list of connections (by scope).
                if (!jpc.suspendedEndpoint) {
                    connections.push(jpc);
                }

                jpc.pending = null;

                // turn off isTemporarySource on the source endpoint (only viable on first draw)
                jpc.endpoints[0].isTemporarySource = false;

                // always inform the anchor manager
                // except that if jpc has a suspended endpoint it's not true to say the
                // connection is new; it has just (possibly) moved. the question is whether
                // to make that call here or in the anchor manager.  i think perhaps here.
                if (doInformAnchorManager !== false) {
                    _currentInstance.anchorManager.newConnection(jpc);
                }

                // force a paint
                _draw(jpc.source);

                // fire an event
                if (!params.doNotFireConnectionEvent && params.fireEvent !== false) {

                    var eventArgs = {
                        connection: jpc,
                        source: jpc.source, target: jpc.target,
                        sourceId: jpc.sourceId, targetId: jpc.targetId,
                        sourceEndpoint: jpc.endpoints[0], targetEndpoint: jpc.endpoints[1]
                    };

                    _currentInstance.fire("connection", eventArgs, originalEvent);
                }
            },

            /*
             factory method to prepare a new endpoint.  this should always be used instead of creating Endpoints
             manually, since this method attaches event listeners and an id.
             */
            _newEndpoint = function (params, id) {
                var endpointFunc = _currentInstance.Defaults.EndpointType || jsPlumb.Endpoint;
                var _p = jsPlumb.extend({}, params);
                _p._jsPlumb = _currentInstance;
                _p.newConnection = _newConnection;
                _p.newEndpoint = _newEndpoint;
                _p.endpointsByUUID = endpointsByUUID;
                _p.endpointsByElement = endpointsByElement;
                _p.fireDetachEvent = fireDetachEvent;
                _p.elementId = id || _getId(_p.source);
                var ep = new endpointFunc(_p);
                ep.id = "ep_" + _idstamp();
                _manage(_p.elementId, _p.source);

                if (!jsPlumb.headless) {
                    _currentInstance.getDragManager().endpointAdded(_p.source, id);
                }

                return ep;
            },

            /*
             * performs the given function operation on all the connections found
             * for the given element id; this means we find all the endpoints for
             * the given element, and then for each endpoint find the connectors
             * connected to it. then we pass each connection in to the given
             * function.
             */
            _operation = function (elId, func, endpointFunc) {
                var endpoints = endpointsByElement[elId];
                if (endpoints && endpoints.length) {
                    for (var i = 0, ii = endpoints.length; i < ii; i++) {
                        for (var j = 0, jj = endpoints[i].connections.length; j < jj; j++) {
                            var retVal = func(endpoints[i].connections[j]);
                            // if the function passed in returns true, we exit.
                            // most functions return false.
                            if (retVal) {
                                return;
                            }
                        }
                        if (endpointFunc) {
                            endpointFunc(endpoints[i]);
                        }
                    }
                }
            },

            _setDraggable = function (element, draggable) {
                return jsPlumb.each(element, function (el) {
                    if (_currentInstance.isDragSupported(el)) {
                        draggableStates[_currentInstance.getAttribute(el, "id")] = draggable;
                        _currentInstance.setElementDraggable(el, draggable);
                    }
                });
            },
            /*
             * private method to do the business of hiding/showing.
             *
             * @param el
             *            either Id of the element in question or a library specific
             *            object for the element.
             * @param state
             *            String specifying a value for the css 'display' property
             *            ('block' or 'none').
             */
            _setVisible = function (el, state, alsoChangeEndpoints) {
                state = state === "block";
                var endpointFunc = null;
                if (alsoChangeEndpoints) {
                    endpointFunc = function (ep) {
                        ep.setVisible(state, true, true);
                    };
                }
                var info = _info(el);
                _operation(info.id, function (jpc) {
                    if (state && alsoChangeEndpoints) {
                        // this test is necessary because this functionality is new, and i wanted to maintain backwards compatibility.
                        // this block will only set a connection to be visible if the other endpoint in the connection is also visible.
                        var oidx = jpc.sourceId === info.id ? 1 : 0;
                        if (jpc.endpoints[oidx].isVisible()) {
                            jpc.setVisible(true);
                        }
                    }
                    else { // the default behaviour for show, and what always happens for hide, is to just set the visibility without getting clever.
                        jpc.setVisible(state);
                    }
                }, endpointFunc);
            },
            /**
             * private method to do the business of toggling hiding/showing.
             */
            _toggleVisible = function (elId, changeEndpoints) {
                var endpointFunc = null;
                if (changeEndpoints) {
                    endpointFunc = function (ep) {
                        var state = ep.isVisible();
                        ep.setVisible(!state);
                    };
                }
                _operation(elId, function (jpc) {
                    var state = jpc.isVisible();
                    jpc.setVisible(!state);
                }, endpointFunc);
            },

            // TODO comparison performance
            _getCachedData = function (elId) {
                var o = offsets[elId];
                if (!o) {
                    return _updateOffset({elId: elId});
                }
                else {
                    return {o: o, s: sizes[elId]};
                }
            },

            /**
             * gets an id for the given element, creating and setting one if
             * necessary.  the id is of the form
             *
             *    jsPlumb_<instance index>_<index in instance>
             *
             * where "index in instance" is a monotonically increasing integer that starts at 0,
             * for each instance.  this method is used not only to assign ids to elements that do not
             * have them but also to connections and endpoints.
             */
            _getId = function (element, uuid, doNotCreateIfNotFound) {
                if (_ju.isString(element)) {
                    return element;
                }
                if (element == null) {
                    return null;
                }
                var id = _currentInstance.getAttribute(element, "id");
                if (!id || id === "undefined") {
                    // check if fixed uuid parameter is given
                    if (arguments.length === 2 && arguments[1] !== undefined) {
                        id = uuid;
                    }
                    else if (arguments.length === 1 || (arguments.length === 3 && !arguments[2])) {
                        id = "jsPlumb_" + _instanceIndex + "_" + _idstamp();
                    }

                    if (!doNotCreateIfNotFound) {
                        _currentInstance.setAttribute(element, "id", id);
                    }
                }
                return id;
            };

        this.setConnectionBeingDragged = function (v) {
            connectionBeingDragged = v;
        };
        this.isConnectionBeingDragged = function () {
            return connectionBeingDragged;
        };

        /**
         * Returns a map of all the elements this jsPlumbInstance is currently managing.
         * @returns {Object} Map of [id-> {el, endpoint[], connection, position}] information.
         */
        this.getManagedElements = function() {
            return managedElements;
        };

        this.connectorClass = "jtk-connector";
        this.connectorOutlineClass = "jtk-connector-outline";
        this.connectedClass = "jtk-connected";
        this.hoverClass = "jtk-hover";
        this.endpointClass = "jtk-endpoint";
        this.endpointConnectedClass = "jtk-endpoint-connected";
        this.endpointFullClass = "jtk-endpoint-full";
        this.endpointDropAllowedClass = "jtk-endpoint-drop-allowed";
        this.endpointDropForbiddenClass = "jtk-endpoint-drop-forbidden";
        this.overlayClass = "jtk-overlay";
        this.draggingClass = "jtk-dragging";// CONVERTED
        this.elementDraggingClass = "jtk-element-dragging";// CONVERTED
        this.sourceElementDraggingClass = "jtk-source-element-dragging"; // CONVERTED
        this.targetElementDraggingClass = "jtk-target-element-dragging";// CONVERTED
        this.endpointAnchorClassPrefix = "jtk-endpoint-anchor";
        this.hoverSourceClass = "jtk-source-hover";
        this.hoverTargetClass = "jtk-target-hover";
        this.dragSelectClass = "jtk-drag-select";

        this.Anchors = {};
        this.Connectors = {  "svg": {} };
        this.Endpoints = { "svg": {} };
        this.Overlays = { "svg": {} } ;
        this.ConnectorRenderers = {};
        this.SVG = "svg";

// --------------------------- jsPlumbInstance public API ---------------------------------------------------------


        this.addEndpoint = function (el, params, referenceParams) {
            referenceParams = referenceParams || {};
            var p = jsPlumb.extend({}, referenceParams);
            jsPlumb.extend(p, params);
            p.endpoint = p.endpoint || _currentInstance.Defaults.Endpoint;
            p.paintStyle = p.paintStyle || _currentInstance.Defaults.EndpointStyle;

            var results = [],
                inputs = (_ju.isArray(el) || (el.length != null && !_ju.isString(el))) ? el : [ el ];

            for (var i = 0, j = inputs.length; i < j; i++) {
                p.source = _currentInstance.getElement(inputs[i]);
                _ensureContainer(p.source);

                var id = _getId(p.source), e = _newEndpoint(p, id);

                // ensure element is managed.
                var myOffset = _manage(id, p.source).info.o;
                _ju.addToList(endpointsByElement, id, e);

                if (!_suspendDrawing) {
                    e.paint({
                        anchorLoc: e.anchor.compute({ xy: [ myOffset.left, myOffset.top ], wh: sizes[id], element: e, timestamp: _suspendedAt }),
                        timestamp: _suspendedAt
                    });
                }

                results.push(e);
            }

            return results.length === 1 ? results[0] : results;
        };

        this.addEndpoints = function (el, endpoints, referenceParams) {
            var results = [];
            for (var i = 0, j = endpoints.length; i < j; i++) {
                var e = _currentInstance.addEndpoint(el, endpoints[i], referenceParams);
                if (_ju.isArray(e)) {
                    Array.prototype.push.apply(results, e);
                }
                else {
                    results.push(e);
                }
            }
            return results;
        };

        this.animate = function (el, properties, options) {
            if (!this.animationSupported) {
                return false;
            }

            options = options || {};
            var del = _currentInstance.getElement(el),
                id = _getId(del),
                stepFunction = jsPlumb.animEvents.step,
                completeFunction = jsPlumb.animEvents.complete;

            options[stepFunction] = _ju.wrap(options[stepFunction], function () {
                _currentInstance.revalidate(id);
            });

            // onComplete repaints, just to make sure everything looks good at the end of the animation.
            options[completeFunction] = _ju.wrap(options[completeFunction], function () {
                _currentInstance.revalidate(id);
            });

            _currentInstance.doAnimate(del, properties, options);
        };

        /**
         * checks for a listener for the given condition, executing it if found, passing in the given value.
         * condition listeners would have been attached using "bind" (which is, you could argue, now overloaded, since
         * firing click events etc is a bit different to what this does).  i thought about adding a "bindCondition"
         * or something, but decided against it, for the sake of simplicity. jsPlumb will never fire one of these
         * condition events anyway.
         */
        this.checkCondition = function (conditionName, args) {
            var l = _currentInstance.getListener(conditionName),
                r = true;

            if (l && l.length > 0) {
                var values = Array.prototype.slice.call(arguments, 1);
                try {
                    for (var i = 0, j = l.length; i < j; i++) {
                        r = r && l[i].apply(l[i], values);
                    }
                }
                catch (e) {
                    _ju.log(_currentInstance, "cannot check condition [" + conditionName + "]" + e);
                }
            }
            return r;
        };

        this.connect = function (params, referenceParams) {
            // prepare a final set of parameters to create connection with
            var _p = _prepareConnectionParams(params, referenceParams), jpc;
            // TODO probably a nicer return value if the connection was not made.  _prepareConnectionParams
            // will return null (and log something) if either endpoint was full.  what would be nicer is to
            // create a dedicated 'error' object.
            if (_p) {
                if (_p.source == null && _p.sourceEndpoint == null) {
                    _ju.log("Cannot establish connection - source does not exist");
                    return;
                }
                if (_p.target == null && _p.targetEndpoint == null) {
                    _ju.log("Cannot establish connection - target does not exist");
                    return;
                }
                _ensureContainer(_p.source);
                // create the connection.  it is not yet registered
                jpc = _newConnection(_p);
                // now add it the model, fire an event, and redraw
                _finaliseConnection(jpc, _p);
            }
            return jpc;
        };

        var stTypes = [
            { el: "source", elId: "sourceId", epDefs: "sourceEndpointDefinitions" },
            { el: "target", elId: "targetId", epDefs: "targetEndpointDefinitions" }
        ];

        var _set = function (c, el, idx, doNotRepaint) {
            var ep, _st = stTypes[idx], cId = c[_st.elId], cEl = c[_st.el], sid, sep,
                oldEndpoint = c.endpoints[idx];

            var evtParams = {
                index: idx,
                originalSourceId: idx === 0 ? cId : c.sourceId,
                newSourceId: c.sourceId,
                originalTargetId: idx === 1 ? cId : c.targetId,
                newTargetId: c.targetId,
                connection: c
            };

            if (el.constructor === jsPlumb.Endpoint) {
                ep = el;
                ep.addConnection(c);
                el = ep.element;
            }
            else {
                sid = _getId(el);
                sep = this[_st.epDefs][sid];

                if (sid === c[_st.elId]) {
                    ep = null; // dont change source/target if the element is already the one given.
                }
                else if (sep) {
                    for (var t in sep) {
                        if (!sep[t].enabled) {
                            return;
                        }
                        ep = sep[t].endpoint != null && sep[t].endpoint._jsPlumb ? sep[t].endpoint : this.addEndpoint(el, sep[t].def);
                        if (sep[t].uniqueEndpoint) {
                            sep[t].endpoint = ep;
                        }
                        ep.addConnection(c);
                    }
                }
                else {
                    ep = c.makeEndpoint(idx === 0, el, sid);
                }
            }

            if (ep != null) {
                oldEndpoint.detachFromConnection(c);
                c.endpoints[idx] = ep;
                c[_st.el] = ep.element;
                c[_st.elId] = ep.elementId;
                evtParams[idx === 0 ? "newSourceId" : "newTargetId"] = ep.elementId;

                fireMoveEvent(evtParams);

                if (!doNotRepaint) {
                    c.repaint();
                }
            }

            evtParams.element = el;
            return evtParams;

        }.bind(this);

        this.setSource = function (connection, el, doNotRepaint) {
            var p = _set(connection, el, 0, doNotRepaint);
            this.anchorManager.sourceChanged(p.originalSourceId, p.newSourceId, connection, p.el);
        };
        this.setTarget = function (connection, el, doNotRepaint) {
            var p = _set(connection, el, 1, doNotRepaint);
            this.anchorManager.updateOtherEndpoint(p.originalSourceId, p.originalTargetId, p.newTargetId, connection);
        };

        this.deleteEndpoint = function (object, dontUpdateHover, deleteAttachedObjects) {
            var endpoint = (typeof object === "string") ? endpointsByUUID[object] : object;
            if (endpoint) {
                _currentInstance.deleteObject({ endpoint: endpoint, dontUpdateHover: dontUpdateHover, deleteAttachedObjects:deleteAttachedObjects });
            }
            return _currentInstance;
        };

        this.deleteEveryEndpoint = function () {
            var _is = _currentInstance.setSuspendDrawing(true);
            for (var id in endpointsByElement) {
                var endpoints = endpointsByElement[id];
                if (endpoints && endpoints.length) {
                    for (var i = 0, j = endpoints.length; i < j; i++) {
                        _currentInstance.deleteEndpoint(endpoints[i], true);
                    }
                }
            }
            endpointsByElement = {};
            managedElements = {};
            endpointsByUUID = {};
            offsets = {};
            offsetTimestamps = {};
            _currentInstance.anchorManager.reset();
            var dm = _currentInstance.getDragManager();
            if (dm) {
                dm.reset();
            }
            if (!_is) {
                _currentInstance.setSuspendDrawing(false);
            }
            return _currentInstance;
        };

        var fireDetachEvent = function (jpc, doFireEvent, originalEvent) {
            // may have been given a connection, or in special cases, an object
            var connType = _currentInstance.Defaults.ConnectionType || _currentInstance.getDefaultConnectionType(),
                argIsConnection = jpc.constructor === connType,
                params = argIsConnection ? {
                    connection: jpc,
                    source: jpc.source, target: jpc.target,
                    sourceId: jpc.sourceId, targetId: jpc.targetId,
                    sourceEndpoint: jpc.endpoints[0], targetEndpoint: jpc.endpoints[1]
                } : jpc;

            if (doFireEvent) {
                _currentInstance.fire("connectionDetached", params, originalEvent);
            }

            // always fire this. used by internal jsplumb stuff.
            _currentInstance.fire("internal.connectionDetached", params, originalEvent);

            _currentInstance.anchorManager.connectionDetached(params);
        };

        var fireMoveEvent = _currentInstance.fireMoveEvent = function (params, evt) {
            _currentInstance.fire("connectionMoved", params, evt);
        };

        this.unregisterEndpoint = function (endpoint) {
            if (endpoint._jsPlumb.uuid) {
                endpointsByUUID[endpoint._jsPlumb.uuid] = null;
            }
            _currentInstance.anchorManager.deleteEndpoint(endpoint);
            // TODO at least replace this with a removeWithFunction call.
            for (var e in endpointsByElement) {
                var endpoints = endpointsByElement[e];
                if (endpoints) {
                    var newEndpoints = [];
                    for (var i = 0, j = endpoints.length; i < j; i++) {
                        if (endpoints[i] !== endpoint) {
                            newEndpoints.push(endpoints[i]);
                        }
                    }

                    endpointsByElement[e] = newEndpoints;
                }
                if (endpointsByElement[e].length < 1) {
                    delete endpointsByElement[e];
                }
            }
        };

        var IS_DETACH_ALLOWED = "isDetachAllowed";
        var BEFORE_DETACH = "beforeDetach";
        var CHECK_CONDITION = "checkCondition";

        /**
         * Deletes a Connection.
         * @method deleteConnection
         * @param connection Connection to delete
         * @param {Object} [params] Optional delete parameters
         * @param {Boolean} [params.doNotFireEvent=false] If true, a connection detached event will not be fired. Otherwise one will.
         * @param {Boolean} [params.force=false] If true, the connection will be deleted even if a beforeDetach interceptor tries to stop the deletion.
         * @returns {Boolean} True if the connection was deleted, false otherwise.
         */
        this.deleteConnection = function(connection, params) {

            if (connection != null) {
                params = params || {};

                if (params.force || _ju.functionChain(true, false, [
                        [ connection.endpoints[0], IS_DETACH_ALLOWED, [ connection ] ],
                        [ connection.endpoints[1], IS_DETACH_ALLOWED, [ connection ] ],
                        [ connection, IS_DETACH_ALLOWED, [ connection ] ],
                        [ _currentInstance, CHECK_CONDITION, [ BEFORE_DETACH, connection ] ]
                    ])) {

                    connection.setHover(false);
                    fireDetachEvent(connection, !connection.pending && params.fireEvent !== false, params.originalEvent);

                    connection.endpoints[0].detachFromConnection(connection);
                    connection.endpoints[1].detachFromConnection(connection);
                    _ju.removeWithFunction(connections, function (_c) {
                        return connection.id === _c.id;
                    });

                    connection.cleanup();
                    connection.destroy();
                    return true;
                }
            }
            return false;
        };

        /**
         * Remove all Connections from all elements, but leaves Endpoints in place ((unless a connection is set to auto delete its Endpoints).
         * @method deleteEveryConnection
         * @param {Object} [params] optional params object for the call
         * @param {Boolean} [params.fireEvent=true] Whether or not to fire detach events
         * @param {Boolean} [params.forceDetach=false] If true, this call will ignore any `beforeDetach` interceptors.
         * @returns {Number} The number of connections that were deleted.
         */
        this.deleteEveryConnection = function (params) {
            params = params || {};
            var count = connections.length, deletedCount = 0;
            _currentInstance.batch(function () {
                for (var i = 0; i < count; i++) {
                    deletedCount += _currentInstance.deleteConnection(connections[0], params) ? 1 : 0;
                }
            });
            return deletedCount;
        };

        /**
         * Removes all an element's Connections.
         * @method deleteConnectionsForElement
         * @param {Object} el Either the id of the element, or a selector for the element.
         * @param {Object} [params] Optional parameters.
         * @param {Boolean} [params.fireEvent=true] Whether or not to fire the detach event.
         * @param {Boolean} [params.forceDetach=false] If true, this call will ignore any `beforeDetach` interceptors.
         * @return {jsPlumbInstance} The current jsPlumb instance.
         */
        this.deleteConnectionsForElement = function (el, params) {
            params = params || {};
            el = _currentInstance.getElement(el);
            var id = _getId(el), endpoints = endpointsByElement[id];
            if (endpoints && endpoints.length) {
                for (var i = 0, j = endpoints.length; i < j; i++) {
                    endpoints[i].deleteEveryConnection(params);
                }
            }
            return _currentInstance;
        };

        /// not public.  but of course its exposed. how to change this.
        this.deleteObject = function (params) {
            var result = {
                    endpoints: {},
                    connections: {},
                    endpointCount: 0,
                    connectionCount: 0
                },
                deleteAttachedObjects = params.deleteAttachedObjects !== false;

            var unravelConnection = function (connection) {
                if (connection != null && result.connections[connection.id] == null) {
                    if (!params.dontUpdateHover && connection._jsPlumb != null) {
                        connection.setHover(false);
                    }
                    result.connections[connection.id] = connection;
                    result.connectionCount++;
                }
            };
            var unravelEndpoint = function (endpoint) {
                if (endpoint != null && result.endpoints[endpoint.id] == null) {
                    if (!params.dontUpdateHover && endpoint._jsPlumb != null) {
                        endpoint.setHover(false);
                    }
                    result.endpoints[endpoint.id] = endpoint;
                    result.endpointCount++;

                    if (deleteAttachedObjects) {
                        for (var i = 0; i < endpoint.connections.length; i++) {
                            var c = endpoint.connections[i];
                            unravelConnection(c);
                        }
                    }
                }
            };

            if (params.connection) {
                unravelConnection(params.connection);
            }
            else {
                unravelEndpoint(params.endpoint);
            }

            // loop through connections
            for (var i in result.connections) {
                var c = result.connections[i];
                if (c._jsPlumb) {
                    _ju.removeWithFunction(connections, function (_c) {
                        return c.id === _c.id;
                    });

                    fireDetachEvent(c, params.fireEvent === false ? false : !c.pending, params.originalEvent);
                    var doNotCleanup = params.deleteAttachedObjects == null ? null : !params.deleteAttachedObjects;

                    c.endpoints[0].detachFromConnection(c, null, doNotCleanup);
                    c.endpoints[1].detachFromConnection(c, null, doNotCleanup);

                    c.cleanup(true);
                    c.destroy(true);
                }
            }

            // loop through endpoints
            for (var j in result.endpoints) {
                var e = result.endpoints[j];
                if (e._jsPlumb) {
                    _currentInstance.unregisterEndpoint(e);
                    // FIRE some endpoint deleted event?
                    e.cleanup(true);
                    e.destroy(true);
                }
            }

            return result;
        };


        // helpers for select/selectEndpoints
        var _setOperation = function (list, func, args, selector) {
                for (var i = 0, j = list.length; i < j; i++) {
                    list[i][func].apply(list[i], args);
                }
                return selector(list);
            },
            _getOperation = function (list, func, args) {
                var out = [];
                for (var i = 0, j = list.length; i < j; i++) {
                    out.push([ list[i][func].apply(list[i], args), list[i] ]);
                }
                return out;
            },
            setter = function (list, func, selector) {
                return function () {
                    return _setOperation(list, func, arguments, selector);
                };
            },
            getter = function (list, func) {
                return function () {
                    return _getOperation(list, func, arguments);
                };
            },
            prepareList = function (input, doNotGetIds) {
                var r = [];
                if (input) {
                    if (typeof input === 'string') {
                        if (input === "*") {
                            return input;
                        }
                        r.push(input);
                    }
                    else {
                        if (doNotGetIds) {
                            r = input;
                        }
                        else {
                            if (input.length) {
                                for (var i = 0, j = input.length; i < j; i++) {
                                    r.push(_info(input[i]).id);
                                }
                            }
                            else {
                                r.push(_info(input).id);
                            }
                        }
                    }
                }
                return r;
            },
            filterList = function (list, value, missingIsFalse) {
                if (list === "*") {
                    return true;
                }
                return list.length > 0 ? list.indexOf(value) !== -1 : !missingIsFalse;
            };

        // get some connections, specifying source/target/scope
        this.getConnections = function (options, flat) {
            if (!options) {
                options = {};
            } else if (options.constructor === String) {
                options = { "scope": options };
            }
            var scope = options.scope || _currentInstance.getDefaultScope(),
                scopes = prepareList(scope, true),
                sources = prepareList(options.source),
                targets = prepareList(options.target),
                results = (!flat && scopes.length > 1) ? {} : [],
                _addOne = function (scope, obj) {
                    if (!flat && scopes.length > 1) {
                        var ss = results[scope];
                        if (ss == null) {
                            ss = results[scope] = [];
                        }
                        ss.push(obj);
                    } else {
                        results.push(obj);
                    }
                };

            for (var j = 0, jj = connections.length; j < jj; j++) {
                var c = connections[j],
                    sourceId = c.proxies && c.proxies[0] ? c.proxies[0].originalEp.elementId : c.sourceId,
                    targetId = c.proxies && c.proxies[1] ? c.proxies[1].originalEp.elementId : c.targetId;

                if (filterList(scopes, c.scope) && filterList(sources, sourceId) && filterList(targets, targetId)) {
                    _addOne(c.scope, c);
                }
            }

            return results;
        };

        var _curryEach = function (list, executor) {
                return function (f) {
                    for (var i = 0, ii = list.length; i < ii; i++) {
                        f(list[i]);
                    }
                    return executor(list);
                };
            },
            _curryGet = function (list) {
                return function (idx) {
                    return list[idx];
                };
            };

        var _makeCommonSelectHandler = function (list, executor) {
            var out = {
                    length: list.length,
                    each: _curryEach(list, executor),
                    get: _curryGet(list)
                },
                setters = ["setHover", "removeAllOverlays", "setLabel", "addClass", "addOverlay", "removeOverlay",
                    "removeOverlays", "showOverlay", "hideOverlay", "showOverlays", "hideOverlays", "setPaintStyle",
                    "setHoverPaintStyle", "setSuspendEvents", "setParameter", "setParameters", "setVisible",
                    "repaint", "addType", "toggleType", "removeType", "removeClass", "setType", "bind", "unbind" ],

                getters = ["getLabel", "getOverlay", "isHover", "getParameter", "getParameters", "getPaintStyle",
                    "getHoverPaintStyle", "isVisible", "hasType", "getType", "isSuspendEvents" ],
                i, ii;

            for (i = 0, ii = setters.length; i < ii; i++) {
                out[setters[i]] = setter(list, setters[i], executor);
            }

            for (i = 0, ii = getters.length; i < ii; i++) {
                out[getters[i]] = getter(list, getters[i]);
            }

            return out;
        };

        var _makeConnectionSelectHandler = function (list) {
            var common = _makeCommonSelectHandler(list, _makeConnectionSelectHandler);
            return jsPlumb.extend(common, {
                // setters
                setDetachable: setter(list, "setDetachable", _makeConnectionSelectHandler),
                setReattach: setter(list, "setReattach", _makeConnectionSelectHandler),
                setConnector: setter(list, "setConnector", _makeConnectionSelectHandler),
                delete: function () {
                    for (var i = 0, ii = list.length; i < ii; i++) {
                        _currentInstance.deleteConnection(list[i]);
                    }
                },
                // getters
                isDetachable: getter(list, "isDetachable"),
                isReattach: getter(list, "isReattach")
            });
        };

        var _makeEndpointSelectHandler = function (list) {
            var common = _makeCommonSelectHandler(list, _makeEndpointSelectHandler);
            return jsPlumb.extend(common, {
                setEnabled: setter(list, "setEnabled", _makeEndpointSelectHandler),
                setAnchor: setter(list, "setAnchor", _makeEndpointSelectHandler),
                isEnabled: getter(list, "isEnabled"),
                deleteEveryConnection: function () {
                    for (var i = 0, ii = list.length; i < ii; i++) {
                        list[i].deleteEveryConnection();
                    }
                },
                "delete": function () {
                    for (var i = 0, ii = list.length; i < ii; i++) {
                        _currentInstance.deleteEndpoint(list[i]);
                    }
                }
            });
        };

        this.select = function (params) {
            params = params || {};
            params.scope = params.scope || "*";
            return _makeConnectionSelectHandler(params.connections || _currentInstance.getConnections(params, true));
        };

        this.selectEndpoints = function (params) {
            params = params || {};
            params.scope = params.scope || "*";
            var noElementFilters = !params.element && !params.source && !params.target,
                elements = noElementFilters ? "*" : prepareList(params.element),
                sources = noElementFilters ? "*" : prepareList(params.source),
                targets = noElementFilters ? "*" : prepareList(params.target),
                scopes = prepareList(params.scope, true);

            var ep = [];

            for (var el in endpointsByElement) {
                var either = filterList(elements, el, true),
                    source = filterList(sources, el, true),
                    sourceMatchExact = sources !== "*",
                    target = filterList(targets, el, true),
                    targetMatchExact = targets !== "*";

                // if they requested 'either' then just match scope. otherwise if they requested 'source' (not as a wildcard) then we have to match only endpoints that have isSource set to to true, and the same thing with isTarget.
                if (either || source || target) {
                    inner:
                        for (var i = 0, ii = endpointsByElement[el].length; i < ii; i++) {
                            var _ep = endpointsByElement[el][i];
                            if (filterList(scopes, _ep.scope, true)) {

                                var noMatchSource = (sourceMatchExact && sources.length > 0 && !_ep.isSource),
                                    noMatchTarget = (targetMatchExact && targets.length > 0 && !_ep.isTarget);

                                if (noMatchSource || noMatchTarget) {
                                    continue inner;
                                }

                                ep.push(_ep);
                            }
                        }
                }
            }

            return _makeEndpointSelectHandler(ep);
        };

        // get all connections managed by the instance of jsplumb.
        this.getAllConnections = function () {
            return connections;
        };
        this.getDefaultScope = function () {
            return DEFAULT_SCOPE;
        };
        // get an endpoint by uuid.
        this.getEndpoint = _getEndpoint;
        /**
         * Gets the list of Endpoints for a given element.
         * @method getEndpoints
         * @param {String|Element|Selector} el The element to get endpoints for.
         * @return {Endpoint[]} An array of Endpoints for the specified element.
         */
        this.getEndpoints = function (el) {
            return endpointsByElement[_info(el).id] || [];
        };
        // gets the default endpoint type. used when subclassing. see wiki.
        this.getDefaultEndpointType = function () {
            return jsPlumb.Endpoint;
        };
        // gets the default connection type. used when subclassing.  see wiki.
        this.getDefaultConnectionType = function () {
            return jsPlumb.Connection;
        };
        /*
         * Gets an element's id, creating one if necessary. really only exposed
         * for the lib-specific functionality to access; would be better to pass
         * the current instance into the lib-specific code (even though this is
         * a static call. i just don't want to expose it to the public API).
         */
        this.getId = _getId;
        this.draw = _draw;
        this.info = _info;

        this.appendElement = _appendElement;

        var _hoverSuspended = false;
        this.isHoverSuspended = function () {
            return _hoverSuspended;
        };
        this.setHoverSuspended = function (s) {
            _hoverSuspended = s;
        };

        // set an element's connections to be hidden
        this.hide = function (el, changeEndpoints) {
            _setVisible(el, "none", changeEndpoints);
            return _currentInstance;
        };

        // exposed for other objects to use to get a unique id.
        this.idstamp = _idstamp;

        // ensure that, if the current container exists, it is a DOM element and not a selector.
        // if it does not exist and `candidate` is supplied, the offset parent of that element will be set as the Container.
        // this is used to do a better default behaviour for the case that the user has not set a container:
        // addEndpoint, makeSource, makeTarget and connect all call this method with the offsetParent of the
        // element in question (for connect it is the source element). So if no container is set, it is inferred
        // to be the offsetParent of the first element the user tries to connect.
        var _ensureContainer = function (candidate) {
            if (!_container && candidate) {
                var can = _currentInstance.getElement(candidate);
                if (can.offsetParent) {
                    _currentInstance.setContainer(can.offsetParent);
                }
            }
        };

        var _getContainerFromDefaults = function () {
            if (_currentInstance.Defaults.Container) {
                _currentInstance.setContainer(_currentInstance.Defaults.Container);
            }
        };

        // check if a given element is managed or not. if not, add to our map. if drawing is not suspended then
        // we'll also stash its dimensions; otherwise we'll do this in a lazy way through updateOffset.
        var _manage = _currentInstance.manage = function (id, element, _transient) {
            if (!managedElements[id]) {
                managedElements[id] = {
                    el: element,
                    endpoints: [],
                    connections: []
                };

                managedElements[id].info = _updateOffset({ elId: id, timestamp: _suspendedAt });
                _currentInstance.addClass(element, "jtk-managed");
                if (!_transient) {
                    _currentInstance.fire("manageElement", { id:id, info:managedElements[id].info, el:element });
                }
            }

            return managedElements[id];
        };

        var _unmanage = _currentInstance.unmanage = function(id) {
            if (managedElements[id]) {
               _currentInstance.removeClass(managedElements[id].el, "jtk-managed");
                delete managedElements[id];
                _currentInstance.fire("unmanageElement", id);
            }
        };

        /**
         * updates the offset and size for a given element, and stores the
         * values. if 'offset' is not null we use that (it would have been
         * passed in from a drag call) because it's faster; but if it is null,
         * or if 'recalc' is true in order to force a recalculation, we get the current values.
         * @method updateOffset
         */
        var _updateOffset = function (params) {

            var timestamp = params.timestamp, recalc = params.recalc, offset = params.offset, elId = params.elId, s;
            if (_suspendDrawing && !timestamp) {
                timestamp = _suspendedAt;
            }
            if (!recalc) {
                if (timestamp && timestamp === offsetTimestamps[elId]) {
                    return {o: params.offset || offsets[elId], s: sizes[elId]};
                }
            }
            if (recalc || (!offset && offsets[elId] == null)) { // if forced repaint or no offset available, we recalculate.

                // get the current size and offset, and store them
                s = managedElements[elId] ? managedElements[elId].el : null;
                if (s != null) {
                    sizes[elId] = _currentInstance.getSize(s);
                    offsets[elId] = _currentInstance.getOffset(s);
                    offsetTimestamps[elId] = timestamp;
                }
            } else {
                offsets[elId] = offset || offsets[elId];
                if (sizes[elId] == null) {
                    s = managedElements[elId].el;
                    if (s != null) {
                        sizes[elId] = _currentInstance.getSize(s);
                    }
                }
                offsetTimestamps[elId] = timestamp;
            }

            if (offsets[elId] && !offsets[elId].right) {
                offsets[elId].right = offsets[elId].left + sizes[elId][0];
                offsets[elId].bottom = offsets[elId].top + sizes[elId][1];
                offsets[elId].width = sizes[elId][0];
                offsets[elId].height = sizes[elId][1];
                offsets[elId].centerx = offsets[elId].left + (offsets[elId].width / 2);
                offsets[elId].centery = offsets[elId].top + (offsets[elId].height / 2);
            }

            return {o: offsets[elId], s: sizes[elId]};
        };

        this.updateOffset = _updateOffset;

        /**
         * callback from the current library to tell us to prepare ourselves (attach
         * mouse listeners etc; can't do that until the library has provided a bind method)
         */
        this.init = function () {
            if (!initialized) {
                _getContainerFromDefaults();
                _currentInstance.anchorManager = new root.jsPlumb.AnchorManager({jsPlumbInstance: _currentInstance});
                initialized = true;
                _currentInstance.fire("ready", _currentInstance);
            }
        }.bind(this);

        this.log = log;
        this.jsPlumbUIComponent = jsPlumbUIComponent;

        /*
         * Creates an anchor with the given params.
         *
         *
         * Returns: The newly created Anchor.
         * Throws: an error if a named anchor was not found.
         */
        this.makeAnchor = function () {
            var pp, _a = function (t, p) {
                if (root.jsPlumb.Anchors[t]) {
                    return new root.jsPlumb.Anchors[t](p);
                }
                if (!_currentInstance.Defaults.DoNotThrowErrors) {
                    throw { msg: "jsPlumb: unknown anchor type '" + t + "'" };
                }
            };
            if (arguments.length === 0) {
                return null;
            }
            var specimen = arguments[0], elementId = arguments[1], jsPlumbInstance = arguments[2], newAnchor = null;
            // if it appears to be an anchor already...
            if (specimen.compute && specimen.getOrientation) {
                return specimen;
            }  //TODO hazy here about whether it should be added or is already added somehow.
            // is it the name of an anchor type?
            else if (typeof specimen === "string") {
                newAnchor = _a(arguments[0], {elementId: elementId, jsPlumbInstance: _currentInstance});
            }
            // is it an array? it will be one of:
            // an array of [spec, params] - this defines a single anchor, which may be dynamic, but has parameters.
            // an array of arrays - this defines some dynamic anchors
            // an array of numbers - this defines a single anchor.
            else if (_ju.isArray(specimen)) {
                if (_ju.isArray(specimen[0]) || _ju.isString(specimen[0])) {
                    // if [spec, params] format
                    if (specimen.length === 2 && _ju.isObject(specimen[1])) {
                        // if first arg is a string, its a named anchor with params
                        if (_ju.isString(specimen[0])) {
                            pp = root.jsPlumb.extend({elementId: elementId, jsPlumbInstance: _currentInstance}, specimen[1]);
                            newAnchor = _a(specimen[0], pp);
                        }
                        // otherwise first arg is array, second is params. we treat as a dynamic anchor, which is fine
                        // even if the first arg has only one entry. you could argue all anchors should be implicitly dynamic in fact.
                        else {
                            pp = root.jsPlumb.extend({elementId: elementId, jsPlumbInstance: _currentInstance, anchors: specimen[0]}, specimen[1]);
                            newAnchor = new root.jsPlumb.DynamicAnchor(pp);
                        }
                    }
                    else {
                        newAnchor = new jsPlumb.DynamicAnchor({anchors: specimen, selector: null, elementId: elementId, jsPlumbInstance: _currentInstance});
                    }

                }
                else {
                    var anchorParams = {
                        x: specimen[0], y: specimen[1],
                        orientation: (specimen.length >= 4) ? [ specimen[2], specimen[3] ] : [0, 0],
                        offsets: (specimen.length >= 6) ? [ specimen[4], specimen[5] ] : [ 0, 0 ],
                        elementId: elementId,
                        jsPlumbInstance: _currentInstance,
                        cssClass: specimen.length === 7 ? specimen[6] : null
                    };
                    newAnchor = new root.jsPlumb.Anchor(anchorParams);
                    newAnchor.clone = function () {
                        return new root.jsPlumb.Anchor(anchorParams);
                    };
                }
            }

            if (!newAnchor.id) {
                newAnchor.id = "anchor_" + _idstamp();
            }
            return newAnchor;
        };

        /**
         * makes a list of anchors from the given list of types or coords, eg
         * ["TopCenter", "RightMiddle", "BottomCenter", [0, 1, -1, -1] ]
         */
        this.makeAnchors = function (types, elementId, jsPlumbInstance) {
            var r = [];
            for (var i = 0, ii = types.length; i < ii; i++) {
                if (typeof types[i] === "string") {
                    r.push(root.jsPlumb.Anchors[types[i]]({elementId: elementId, jsPlumbInstance: jsPlumbInstance}));
                }
                else if (_ju.isArray(types[i])) {
                    r.push(_currentInstance.makeAnchor(types[i], elementId, jsPlumbInstance));
                }
            }
            return r;
        };

        /**
         * Makes a dynamic anchor from the given list of anchors (which may be in shorthand notation as strings or dimension arrays, or Anchor
         * objects themselves) and the given, optional, anchorSelector function (jsPlumb uses a default if this is not provided; most people will
         * not need to provide this - i think).
         */
        this.makeDynamicAnchor = function (anchors, anchorSelector) {
            return new root.jsPlumb.DynamicAnchor({anchors: anchors, selector: anchorSelector, elementId: null, jsPlumbInstance: _currentInstance});
        };

// --------------------- makeSource/makeTarget ----------------------------------------------

        this.targetEndpointDefinitions = {};
        this.sourceEndpointDefinitions = {};

        var selectorFilter = function (evt, _el, selector, _instance, negate) {
            var t = evt.target || evt.srcElement, ok = false,
                sel = _instance.getSelector(_el, selector);
            for (var j = 0; j < sel.length; j++) {
                if (sel[j] === t) {
                    ok = true;
                    break;
                }
            }
            return negate ? !ok : ok;
        };

        var _makeElementDropHandler = function (elInfo, p, dropOptions, isSource, isTarget) {
            var proxyComponent = new jsPlumbUIComponent(p);
            var _drop = p._jsPlumb.EndpointDropHandler({
                jsPlumb: _currentInstance,
                enabled: function () {
                    return elInfo.def.enabled;
                },
                isFull: function () {
                    var targetCount = _currentInstance.select({target: elInfo.id}).length;
                    return elInfo.def.maxConnections > 0 && targetCount >= elInfo.def.maxConnections;
                },
                element: elInfo.el,
                elementId: elInfo.id,
                isSource: isSource,
                isTarget: isTarget,
                addClass: function (clazz) {
                    _currentInstance.addClass(elInfo.el, clazz);
                },
                removeClass: function (clazz) {
                    _currentInstance.removeClass(elInfo.el, clazz);
                },
                onDrop: function (jpc) {
                    var source = jpc.endpoints[0];
                    source.anchor.unlock();
                },
                isDropAllowed: function () {
                    return proxyComponent.isDropAllowed.apply(proxyComponent, arguments);
                },
                isRedrop:function(jpc) {
                    return (jpc.suspendedElement != null && jpc.suspendedEndpoint != null && jpc.suspendedEndpoint.element === elInfo.el);
                },
                getEndpoint: function (jpc) {

                    // make a new Endpoint for the target, or get it from the cache if uniqueEndpoint
                    // is set. if its a redrop the new endpoint will be immediately cleaned up.

                    var newEndpoint = elInfo.def.endpoint;

                    // if no cached endpoint, or there was one but it has been cleaned up
                    // (ie. detached), create a new one
                    if (newEndpoint == null || newEndpoint._jsPlumb == null) {
                        var eps = _currentInstance.deriveEndpointAndAnchorSpec(jpc.getType().join(" "), true);
                        var pp = eps.endpoints ? root.jsPlumb.extend(p, {
                            endpoint:elInfo.def.def.endpoint || eps.endpoints[1]
                        }) :p;
                        if (eps.anchors) {
                            pp = root.jsPlumb.extend(pp, {
                                anchor:elInfo.def.def.anchor || eps.anchors[1]
                            });
                        }
                        newEndpoint = _currentInstance.addEndpoint(elInfo.el, pp);
                        newEndpoint._mtNew = true;
                    }

                    if (p.uniqueEndpoint) {
                        elInfo.def.endpoint = newEndpoint;
                    }

                    newEndpoint.setDeleteOnEmpty(true);

                    // if connection is detachable, init the new endpoint to be draggable, to support that happening.
                    if (jpc.isDetachable()) {
                        newEndpoint.initDraggable();
                    }

                    // if the anchor has a 'positionFinder' set, then delegate to that function to find
                    // out where to locate the anchor.
                    if (newEndpoint.anchor.positionFinder != null) {
                        var dropPosition = _currentInstance.getUIPosition(arguments, _currentInstance.getZoom()),
                            elPosition = _currentInstance.getOffset(elInfo.el),
                            elSize = _currentInstance.getSize(elInfo.el),
                            ap = dropPosition == null ? [0,0] : newEndpoint.anchor.positionFinder(dropPosition, elPosition, elSize, newEndpoint.anchor.constructorParams);

                        newEndpoint.anchor.x = ap[0];
                        newEndpoint.anchor.y = ap[1];
                        // now figure an orientation for it..kind of hard to know what to do actually. probably the best thing i can do is to
                        // support specifying an orientation in the anchor's spec. if one is not supplied then i will make the orientation
                        // be what will cause the most natural link to the source: it will be pointing at the source, but it needs to be
                        // specified in one axis only, and so how to make that choice? i think i will use whichever axis is the one in which
                        // the target is furthest away from the source.
                    }

                    return newEndpoint;
                },
                maybeCleanup: function (ep) {
                    if (ep._mtNew && ep.connections.length === 0) {
                        _currentInstance.deleteObject({endpoint: ep});
                    }
                    else {
                        delete ep._mtNew;
                    }
                }
            });

            // wrap drop events as needed and initialise droppable
            var dropEvent = root.jsPlumb.dragEvents.drop;
            dropOptions.scope = dropOptions.scope || (p.scope || _currentInstance.Defaults.Scope);
            dropOptions[dropEvent] = _ju.wrap(dropOptions[dropEvent], _drop, true);
            dropOptions.rank = p.rank || 0;

            // if target, return true from the over event. this will cause katavorio to stop setting drops to hover
            // if multipleDrop is set to false.
            if (isTarget) {
                dropOptions[root.jsPlumb.dragEvents.over] = function () { return true; };
            }

            // vanilla jsplumb only
            if (p.allowLoopback === false) {
                dropOptions.canDrop = function (_drag) {
                    var de = _drag.getDragElement()._jsPlumbRelatedElement;
                    return de !== elInfo.el;
                };
            }
            _currentInstance.initDroppable(elInfo.el, dropOptions, "internal");

            return _drop;

        };

        // see API docs
        this.makeTarget = function (el, params, referenceParams) {

            // put jsplumb ref into params without altering the params passed in
            var p = root.jsPlumb.extend({_jsPlumb: this}, referenceParams);
            root.jsPlumb.extend(p, params);

            var maxConnections = p.maxConnections || -1,

                _doOne = function (el) {

                    // get the element's id and store the endpoint definition for it.  jsPlumb.connect calls will look for one of these,
                    // and use the endpoint definition if found.
                    // decode the info for this element (id and element)
                    var elInfo = _info(el),
                        elid = elInfo.id,
                        dropOptions = root.jsPlumb.extend({}, p.dropOptions || {}),
                        type = p.connectionType || "default";

                    this.targetEndpointDefinitions[elid] = this.targetEndpointDefinitions[elid] || {};

                    _ensureContainer(elid);

                    // if this is a group and the user has not mandated a rank, set to -1 so that Nodes takes
                    // precedence.
                    if (elInfo.el._isJsPlumbGroup && dropOptions.rank == null) {
                        dropOptions.rank = -1;
                    }

                    // store the definition
                    var _def = {
                        def: root.jsPlumb.extend({}, p),
                        uniqueEndpoint: p.uniqueEndpoint,
                        maxConnections: maxConnections,
                        enabled: true
                    };

                    if (p.createEndpoint) {
                        _def.uniqueEndpoint = true;
                        _def.endpoint = _currentInstance.addEndpoint(el, _def.def);
                        _def.endpoint.setDeleteOnEmpty(false);
                    }

                    elInfo.def = _def;
                    this.targetEndpointDefinitions[elid][type] = _def;
                    _makeElementDropHandler(elInfo, p, dropOptions, p.isSource === true, true);
                    // stash the definition on the drop
                    elInfo.el._katavorioDrop[elInfo.el._katavorioDrop.length - 1].targetDef = _def;

                }.bind(this);

            // make an array if only given one element
            var inputs = el.length && el.constructor !== String ? el : [ el ];

            // register each one in the list.
            for (var i = 0, ii = inputs.length; i < ii; i++) {
                _doOne(inputs[i]);
            }

            return this;
        };

        // see api docs
        this.unmakeTarget = function (el, doNotClearArrays) {
            var info = _info(el);
            _currentInstance.destroyDroppable(info.el, "internal");
            if (!doNotClearArrays) {
                delete this.targetEndpointDefinitions[info.id];
            }

            return this;
        };

        // see api docs
        this.makeSource = function (el, params, referenceParams) {
            var p = root.jsPlumb.extend({_jsPlumb: this}, referenceParams);
            root.jsPlumb.extend(p, params);
            var type = p.connectionType || "default";
            var aae = _currentInstance.deriveEndpointAndAnchorSpec(type);
            p.endpoint = p.endpoint || aae.endpoints[0];
            p.anchor = p.anchor || aae.anchors[0];
            var maxConnections = p.maxConnections || -1,
                onMaxConnections = p.onMaxConnections,
                _doOne = function (elInfo) {
                    // get the element's id and store the endpoint definition for it.  jsPlumb.connect calls will look for one of these,
                    // and use the endpoint definition if found.
                    var elid = elInfo.id,
                        _del = this.getElement(elInfo.el);

                    this.sourceEndpointDefinitions[elid] = this.sourceEndpointDefinitions[elid] || {};
                    _ensureContainer(elid);

                    var _def = {
                        def:root.jsPlumb.extend({}, p),
                        uniqueEndpoint: p.uniqueEndpoint,
                        maxConnections: maxConnections,
                        enabled: true
                    };

                    if (p.createEndpoint) {
                        _def.uniqueEndpoint = true;
                        _def.endpoint = _currentInstance.addEndpoint(el, _def.def);
                        _def.endpoint.setDeleteOnEmpty(false);
                    }

                    this.sourceEndpointDefinitions[elid][type] = _def;
                    elInfo.def = _def;

                    var stopEvent = root.jsPlumb.dragEvents.stop,
                        dragEvent = root.jsPlumb.dragEvents.drag,
                        dragOptions = root.jsPlumb.extend({ }, p.dragOptions || {}),
                        existingDrag = dragOptions.drag,
                        existingStop = dragOptions.stop,
                        ep = null,
                        endpointAddedButNoDragYet = false;

                    // set scope if its not set in dragOptions but was passed in in params
                    dragOptions.scope = dragOptions.scope || p.scope;

                    dragOptions[dragEvent] = _ju.wrap(dragOptions[dragEvent], function () {
                        if (existingDrag) {
                            existingDrag.apply(this, arguments);
                        }
                        endpointAddedButNoDragYet = false;
                    });

                    dragOptions[stopEvent] = _ju.wrap(dragOptions[stopEvent], function () {

                        if (existingStop) {
                            existingStop.apply(this, arguments);
                        }
                        this.currentlyDragging = false;
                        if (ep._jsPlumb != null) { // if not cleaned up...

                            // reset the anchor to the anchor that was initially provided. the one we were using to drag
                            // the connection was just a placeholder that was located at the place the user pressed the
                            // mouse button to initiate the drag.
                            var anchorDef = p.anchor || this.Defaults.Anchor,
                                oldAnchor = ep.anchor,
                                oldConnection = ep.connections[0];

                            var    newAnchor = this.makeAnchor(anchorDef, elid, this),
                                _el = ep.element;

                            // if the anchor has a 'positionFinder' set, then delegate to that function to find
                            // out where to locate the anchor. issue 117.
                            if (newAnchor.positionFinder != null) {
                                var elPosition = _currentInstance.getOffset(_el),
                                    elSize = this.getSize(_el),
                                    dropPosition = { left: elPosition.left + (oldAnchor.x * elSize[0]), top: elPosition.top + (oldAnchor.y * elSize[1]) },
                                    ap = newAnchor.positionFinder(dropPosition, elPosition, elSize, newAnchor.constructorParams);

                                newAnchor.x = ap[0];
                                newAnchor.y = ap[1];
                            }

                            ep.setAnchor(newAnchor, true);
                            ep.repaint();
                            this.repaint(ep.elementId);
                            if (oldConnection != null) {
                                this.repaint(oldConnection.targetId);
                            }
                        }
                    }.bind(this));

                    // when the user presses the mouse, add an Endpoint, if we are enabled.
                    var mouseDownListener = function (e) {
                        // on right mouse button, abort.
                        if (e.which === 3 || e.button === 2) {
                            return;
                        }

                        // TODO store def on element.
                        var def = this.sourceEndpointDefinitions[elid][type];

                        // if disabled, return.
                        if (!def.enabled) {
                            return;
                        }

                        elid = this.getId(this.getElement(elInfo.el)); // elid might have changed since this method was called to configure the element.

                        // if a filter was given, run it, and return if it says no.
                        if (p.filter) {
                            var r = _ju.isString(p.filter) ? selectorFilter(e, elInfo.el, p.filter, this, p.filterExclude) : p.filter(e, elInfo.el);
                            if (r === false) {
                                return;
                            }
                        }

                        // if maxConnections reached
                        var sourceCount = this.select({source: elid}).length;
                        if (def.maxConnections >= 0 && (sourceCount >= def.maxConnections)) {
                            if (onMaxConnections) {
                                onMaxConnections({
                                    element: elInfo.el,
                                    maxConnections: maxConnections
                                }, e);
                            }
                            return false;
                        }

                        // find the position on the element at which the mouse was pressed; this is where the endpoint
                        // will be located.
                        var elxy = root.jsPlumb.getPositionOnElement(e, _del, _zoom);

                        // we need to override the anchor in here, and force 'isSource', but we don't want to mess with
                        // the params passed in, because after a connection is established we're going to reset the endpoint
                        // to have the anchor we were given.
                        var tempEndpointParams = {};
                        root.jsPlumb.extend(tempEndpointParams, p);
                        tempEndpointParams.isTemporarySource = true;
                        tempEndpointParams.anchor = [ elxy[0], elxy[1] , 0, 0];
                        tempEndpointParams.dragOptions = dragOptions;

                        if (def.def.scope) {
                            tempEndpointParams.scope = def.def.scope;
                        }

                        ep = this.addEndpoint(elid, tempEndpointParams);
                        endpointAddedButNoDragYet = true;
                        ep.setDeleteOnEmpty(true);

                        // if unique endpoint and it's already been created, push it onto the endpoint we create. at the end
                        // of a successful connection we'll switch to that endpoint.
                        // TODO this is the same code as the programmatic endpoints create on line 1050 ish
                        if (def.uniqueEndpoint) {
                            if (!def.endpoint) {
                                def.endpoint = ep;
                                ep.setDeleteOnEmpty(false);
                            }
                            else {
                                ep.finalEndpoint = def.endpoint;
                            }
                        }

                        var _delTempEndpoint = function () {
                            // this mouseup event is fired only if no dragging occurred, by jquery and yui, but for mootools
                            // it is fired even if dragging has occurred, in which case we would blow away a perfectly
                            // legitimate endpoint, were it not for this check.  the flag is set after adding an
                            // endpoint and cleared in a drag listener we set in the dragOptions above.
                            _currentInstance.off(ep.canvas, "mouseup", _delTempEndpoint);
                            _currentInstance.off(elInfo.el, "mouseup", _delTempEndpoint);
                            if (endpointAddedButNoDragYet) {
                                endpointAddedButNoDragYet = false;
                                _currentInstance.deleteEndpoint(ep);
                            }
                        };

                        _currentInstance.on(ep.canvas, "mouseup", _delTempEndpoint);
                        _currentInstance.on(elInfo.el, "mouseup", _delTempEndpoint);

                        // optionally check for attributes to extract from the source element
                        var payload = {};
                        if (def.def.extract) {
                            for (var att in def.def.extract) {
                                var v = (e.srcElement || e.target).getAttribute(att);
                                if (v) {
                                    payload[def.def.extract[att]] = v;
                                }
                            }
                        }

                        // and then trigger its mousedown event, which will kick off a drag, which will start dragging
                        // a new connection from this endpoint.
                        _currentInstance.trigger(ep.canvas, "mousedown", e, payload);

                        _ju.consume(e);

                    }.bind(this);

                    this.on(elInfo.el, "mousedown", mouseDownListener);
                    _def.trigger = mouseDownListener;

                    // if a filter was provided, set it as a dragFilter on the element,
                    // to prevent the element drag function from kicking in when we want to
                    // drag a new connection
                    if (p.filter && (_ju.isString(p.filter) || _ju.isFunction(p.filter))) {
                        _currentInstance.setDragFilter(elInfo.el, p.filter);
                    }

                    var dropOptions = root.jsPlumb.extend({}, p.dropOptions || {});

                    _makeElementDropHandler(elInfo, p, dropOptions, true, p.isTarget === true);

                }.bind(this);

            var inputs = el.length && el.constructor !== String ? el : [ el ];
            for (var i = 0, ii = inputs.length; i < ii; i++) {
                _doOne(_info(inputs[i]));
            }

            return this;
        };

        // see api docs
        this.unmakeSource = function (el, connectionType, doNotClearArrays) {
            var info = _info(el);
            _currentInstance.destroyDroppable(info.el, "internal");
            var eldefs = this.sourceEndpointDefinitions[info.id];
            if (eldefs) {
                for (var def in eldefs) {
                    if (connectionType == null || connectionType === def) {
                        var mouseDownListener = eldefs[def].trigger;
                        if (mouseDownListener) {
                            _currentInstance.off(info.el, "mousedown", mouseDownListener);
                        }
                        if (!doNotClearArrays) {
                            delete this.sourceEndpointDefinitions[info.id][def];
                        }
                    }
                }
            }

            return this;
        };

        // see api docs
        this.unmakeEverySource = function () {
            for (var i in this.sourceEndpointDefinitions) {
                _currentInstance.unmakeSource(i, null, true);
            }

            this.sourceEndpointDefinitions = {};
            return this;
        };

        var _getScope = function (el, types, connectionType) {
            types = _ju.isArray(types) ? types : [ types ];
            var id = _getId(el);
            connectionType = connectionType || "default";
            for (var i = 0; i < types.length; i++) {
                var eldefs = this[types[i]][id];
                if (eldefs && eldefs[connectionType]) {
                    return eldefs[connectionType].def.scope || this.Defaults.Scope;
                }
            }
        }.bind(this);

        var _setScope = function (el, scope, types, connectionType) {
            types = _ju.isArray(types) ? types : [ types ];
            var id = _getId(el);
            connectionType = connectionType || "default";
            for (var i = 0; i < types.length; i++) {
                var eldefs = this[types[i]][id];
                if (eldefs && eldefs[connectionType]) {
                    eldefs[connectionType].def.scope = scope;
                }
            }

        }.bind(this);

        this.getScope = function (el, scope) {
            return _getScope(el, [ "sourceEndpointDefinitions", "targetEndpointDefinitions" ]);
        };
        this.getSourceScope = function (el) {
            return _getScope(el, "sourceEndpointDefinitions");
        };
        this.getTargetScope = function (el) {
            return _getScope(el, "targetEndpointDefinitions");
        };
        this.setScope = function (el, scope, connectionType) {
            this.setSourceScope(el, scope, connectionType);
            this.setTargetScope(el, scope, connectionType);
        };
        this.setSourceScope = function (el, scope, connectionType) {
            _setScope(el, scope, "sourceEndpointDefinitions", connectionType);
            // we get the source scope during the mousedown event, but we also want to set this.
            this.setDragScope(el, scope);
        };
        this.setTargetScope = function (el, scope, connectionType) {
            _setScope(el, scope, "targetEndpointDefinitions", connectionType);
            this.setDropScope(el, scope);
        };

        // see api docs
        this.unmakeEveryTarget = function () {
            for (var i in this.targetEndpointDefinitions) {
                _currentInstance.unmakeTarget(i, true);
            }

            this.targetEndpointDefinitions = {};
            return this;
        };

        // does the work of setting a source enabled or disabled.
        var _setEnabled = function (type, el, state, toggle, connectionType) {
            var a = type === "source" ? this.sourceEndpointDefinitions : this.targetEndpointDefinitions,
                originalState, info, newState;

            connectionType = connectionType || "default";

            // a selector or an array
            if (el.length && !_ju.isString(el)) {
                originalState = [];
                for (var i = 0, ii = el.length; i < ii; i++) {
                    info = _info(el[i]);
                    if (a[info.id] && a[info.id][connectionType]) {
                        originalState[i] = a[info.id][connectionType].enabled;
                        newState = toggle ? !originalState[i] : state;
                        a[info.id][connectionType].enabled = newState;
                        _currentInstance[newState ? "removeClass" : "addClass"](info.el, "jtk-" + type + "-disabled");
                    }
                }
            }
            // otherwise a DOM element or a String ID.
            else {
                info = _info(el);
                var id = info.id;
                if (a[id] && a[id][connectionType]) {
                    originalState = a[id][connectionType].enabled;
                    newState = toggle ? !originalState : state;
                    a[id][connectionType].enabled = newState;
                    _currentInstance[newState ? "removeClass" : "addClass"](info.el, "jtk-" + type + "-disabled");
                }
            }
            return originalState;
        }.bind(this);

        var _first = function (el, fn) {
            if (_ju.isString(el) || !el.length) {
                return fn.apply(this, [ el ]);
            }
            else if (el.length) {
                return fn.apply(this, [ el[0] ]);
            }

        }.bind(this);

        this.toggleSourceEnabled = function (el, connectionType) {
            _setEnabled("source", el, null, true, connectionType);
            return this.isSourceEnabled(el, connectionType);
        };

        this.setSourceEnabled = function (el, state, connectionType) {
            return _setEnabled("source", el, state, null, connectionType);
        };
        this.isSource = function (el, connectionType) {
            connectionType = connectionType || "default";
            return _first(el, function (_el) {
                var eldefs = this.sourceEndpointDefinitions[_info(_el).id];
                return eldefs != null && eldefs[connectionType] != null;
            }.bind(this));
        };
        this.isSourceEnabled = function (el, connectionType) {
            connectionType = connectionType || "default";
            return _first(el, function (_el) {
                var sep = this.sourceEndpointDefinitions[_info(_el).id];
                return sep && sep[connectionType] && sep[connectionType].enabled === true;
            }.bind(this));
        };

        this.toggleTargetEnabled = function (el, connectionType) {
            _setEnabled("target", el, null, true, connectionType);
            return this.isTargetEnabled(el, connectionType);
        };

        this.isTarget = function (el, connectionType) {
            connectionType = connectionType || "default";
            return _first(el, function (_el) {
                var eldefs = this.targetEndpointDefinitions[_info(_el).id];
                return eldefs != null && eldefs[connectionType] != null;
            }.bind(this));
        };
        this.isTargetEnabled = function (el, connectionType) {
            connectionType = connectionType || "default";
            return _first(el, function (_el) {
                var tep = this.targetEndpointDefinitions[_info(_el).id];
                return tep && tep[connectionType] && tep[connectionType].enabled === true;
            }.bind(this));
        };
        this.setTargetEnabled = function (el, state, connectionType) {
            return _setEnabled("target", el, state, null, connectionType);
        };

// --------------------- end makeSource/makeTarget ----------------------------------------------

        this.ready = function (fn) {
            _currentInstance.bind("ready", fn);
        };

        var _elEach = function(el, fn) {
            // support both lists...
            if (typeof el === 'object' && el.length) {
                for (var i = 0, ii = el.length; i < ii; i++) {
                    fn(el[i]);
                }
            }
            else {// ...and single strings or elements.
                fn(el);
            }

            return _currentInstance;
        };

        // repaint some element's endpoints and connections
        this.repaint = function (el, ui, timestamp) {
            return _elEach(el, function(_el) {
                _draw(_el, ui, timestamp);
            });
        };

        this.revalidate = function (el, timestamp, isIdAlready) {
            return _elEach(el, function(_el) {
                var elId = isIdAlready ? _el : _currentInstance.getId(_el);
                _currentInstance.updateOffset({ elId: elId, recalc: true, timestamp:timestamp });
                var dm = _currentInstance.getDragManager();
                if (dm) {
                    dm.updateOffsets(elId);
                }
                _currentInstance.repaint(_el);
            });
        };

        // repaint every endpoint and connection.
        this.repaintEverything = function () {
            // TODO this timestamp causes continuous anchors to not repaint properly.
            // fix this. do not just take out the timestamp. it runs a lot faster with
            // the timestamp included.
            var timestamp = _timestamp(), elId;

            for (elId in endpointsByElement) {
                _currentInstance.updateOffset({ elId: elId, recalc: true, timestamp: timestamp });
            }

            for (elId in endpointsByElement) {
                _draw(elId, null, timestamp);
            }

            return this;
        };

        this.removeAllEndpoints = function (el, recurse, affectedElements) {
            affectedElements = affectedElements || [];
            var _one = function (_el) {
                var info = _info(_el),
                    ebe = endpointsByElement[info.id],
                    i, ii;

                if (ebe) {
                    affectedElements.push(info);
                    for (i = 0, ii = ebe.length; i < ii; i++) {
                        _currentInstance.deleteEndpoint(ebe[i], false);
                    }
                }
                delete endpointsByElement[info.id];

                if (recurse) {
                    if (info.el && info.el.nodeType !== 3 && info.el.nodeType !== 8) {
                        for (i = 0, ii = info.el.childNodes.length; i < ii; i++) {
                            _one(info.el.childNodes[i]);
                        }
                    }
                }

            };
            _one(el);
            return this;
        };

        var _doRemove = function(info, affectedElements) {
            _currentInstance.removeAllEndpoints(info.id, true, affectedElements);
            var dm = _currentInstance.getDragManager();
            var _one = function(_info) {

                if (dm) {
                    dm.elementRemoved(_info.id);
                }
                _currentInstance.anchorManager.clearFor(_info.id);
                _currentInstance.anchorManager.removeFloatingConnection(_info.id);

                if (_currentInstance.isSource(_info.el)) {
                    _currentInstance.unmakeSource(_info.el);
                }
                if (_currentInstance.isTarget(_info.el)) {
                    _currentInstance.unmakeTarget(_info.el);
                }
                _currentInstance.destroyDraggable(_info.el);
                _currentInstance.destroyDroppable(_info.el);


                delete _currentInstance.floatingConnections[_info.id];
                delete managedElements[_info.id];
                delete offsets[_info.id];
                if (_info.el) {
                    _currentInstance.removeElement(_info.el);
                    _info.el._jsPlumb = null;
                }
            };

            // remove all affected child elements
            for (var ae = 1; ae < affectedElements.length; ae++) {
                _one(affectedElements[ae]);
            }
            // and always remove the requested one from the dom.
            _one(info);
        };

        /**
         * Remove the given element, including cleaning up all endpoints registered for it.
         * This is exposed in the public API but also used internally by jsPlumb when removing the
         * element associated with a connection drag.
         */
        this.remove = function (el, doNotRepaint) {
            var info = _info(el), affectedElements = [];
            if (info.text) {
                info.el.parentNode.removeChild(info.el);
            }
            else if (info.id) {
                _currentInstance.batch(function () {
                    _doRemove(info, affectedElements);
                }, doNotRepaint === true);
            }
            return _currentInstance;
        };

        this.empty = function (el, doNotRepaint) {
            var affectedElements = [];
            var _one = function(el, dontRemoveFocus) {
                var info = _info(el);
                if (info.text) {
                    info.el.parentNode.removeChild(info.el);
                }
                else if (info.el) {
                    while(info.el.childNodes.length > 0) {
                        _one(info.el.childNodes[0]);
                    }
                    if (!dontRemoveFocus) {
                        _doRemove(info, affectedElements);
                    }
                }
            };

            _currentInstance.batch(function() {
                _one(el, true);
            }, doNotRepaint === false);

            return _currentInstance;
        };

        this.reset = function (doNotUnbindInstanceEventListeners) {
            _currentInstance.silently(function() {
                _hoverSuspended = false;
                _currentInstance.removeAllGroups();
                _currentInstance.removeGroupManager();
                _currentInstance.deleteEveryEndpoint();
                if (!doNotUnbindInstanceEventListeners) {
                    _currentInstance.unbind();
                }
                this.targetEndpointDefinitions = {};
                this.sourceEndpointDefinitions = {};
                connections.length = 0;
                if (this.doReset) {
                    this.doReset();
                }
            }.bind(this));
        };

        var _clearObject = function (obj) {
            if (obj.canvas && obj.canvas.parentNode) {
                obj.canvas.parentNode.removeChild(obj.canvas);
            }
            obj.cleanup();
            obj.destroy();
        };

        this.clear = function () {
            _currentInstance.select().each(_clearObject);
            _currentInstance.selectEndpoints().each(_clearObject);

            endpointsByElement = {};
            endpointsByUUID = {};
        };

        this.setDefaultScope = function (scope) {
            DEFAULT_SCOPE = scope;
            return _currentInstance;
        };

        this.deriveEndpointAndAnchorSpec = function(type, dontPrependDefault) {
            var bits = ((dontPrependDefault ? "" : "default ") + type).split(/[\s]/), eps = null, ep = null, a = null, as = null;
            for (var i = 0; i < bits.length; i++) {
                var _t = _currentInstance.getType(bits[i], "connection");
                if (_t) {
                    if (_t.endpoints) {
                        eps = _t.endpoints;
                    }
                    if (_t.endpoint) {
                        ep = _t.endpoint;
                    }
                    if (_t.anchors) {
                        as = _t.anchors;
                    }
                    if (_t.anchor) {
                        a = _t.anchor;
                    }
                }
            }
            return { endpoints: eps ? eps : [ ep, ep ], anchors: as ? as : [a, a ]};
        };

        // sets the id of some element, changing whatever we need to to keep track.
        this.setId = function (el, newId, doNotSetAttribute) {
            //
            var id;

            if (_ju.isString(el)) {
                id = el;
            }
            else {
                el = this.getElement(el);
                id = this.getId(el);
            }

            var sConns = this.getConnections({source: id, scope: '*'}, true),
                tConns = this.getConnections({target: id, scope: '*'}, true);

            newId = "" + newId;

            if (!doNotSetAttribute) {
                el = this.getElement(id);
                this.setAttribute(el, "id", newId);
            }
            else {
                el = this.getElement(newId);
            }

            endpointsByElement[newId] = endpointsByElement[id] || [];
            for (var i = 0, ii = endpointsByElement[newId].length; i < ii; i++) {
                endpointsByElement[newId][i].setElementId(newId);
                endpointsByElement[newId][i].setReferenceElement(el);
            }
            delete endpointsByElement[id];

            this.sourceEndpointDefinitions[newId] = this.sourceEndpointDefinitions[id];
            delete this.sourceEndpointDefinitions[id];
            this.targetEndpointDefinitions[newId] = this.targetEndpointDefinitions[id];
            delete this.targetEndpointDefinitions[id];

            this.anchorManager.changeId(id, newId);
            var dm = this.getDragManager();
            if (dm) {
                dm.changeId(id, newId);
            }
            managedElements[newId] = managedElements[id];
            delete managedElements[id];

            var _conns = function (list, epIdx, type) {
                for (var i = 0, ii = list.length; i < ii; i++) {
                    list[i].endpoints[epIdx].setElementId(newId);
                    list[i].endpoints[epIdx].setReferenceElement(el);
                    list[i][type + "Id"] = newId;
                    list[i][type] = el;
                }
            };
            _conns(sConns, 0, "source");
            _conns(tConns, 1, "target");

            this.repaint(newId);
        };

        this.setDebugLog = function (debugLog) {
            log = debugLog;
        };

        this.setSuspendDrawing = function (val, repaintAfterwards) {
            var curVal = _suspendDrawing;
            _suspendDrawing = val;
            if (val) {
                _suspendedAt = new Date().getTime();
            } else {
                _suspendedAt = null;
            }
            if (repaintAfterwards) {
                this.repaintEverything();
            }
            return curVal;
        };

        // returns whether or not drawing is currently suspended.
        this.isSuspendDrawing = function () {
            return _suspendDrawing;
        };

        // return timestamp for when drawing was suspended.
        this.getSuspendedAt = function () {
            return _suspendedAt;
        };

        this.batch = function (fn, doNotRepaintAfterwards) {
            var _wasSuspended = this.isSuspendDrawing();
            if (!_wasSuspended) {
                this.setSuspendDrawing(true);
            }
            try {
                fn();
            }
            catch (e) {
                _ju.log("Function run while suspended failed", e);
            }
            if (!_wasSuspended) {
                this.setSuspendDrawing(false, !doNotRepaintAfterwards);
            }
        };

        this.doWhileSuspended = this.batch;

        this.getCachedData = _getCachedData;
        this.timestamp = _timestamp;
        this.show = function (el, changeEndpoints) {
            _setVisible(el, "block", changeEndpoints);
            return _currentInstance;
        };

        // TODO: update this method to return the current state.
        this.toggleVisible = _toggleVisible;
        this.addListener = this.bind;

        var floatingConnections = [];
        this.registerFloatingConnection = function(info, conn, ep) {
            floatingConnections[info.id] = conn;
            // only register for the target endpoint; we will not be dragging the source at any time
            // before this connection is either discarded or made into a permanent connection.
            _ju.addToList(endpointsByElement, info.id, ep);
        };
        this.getFloatingConnectionFor = function(id) {
            return floatingConnections[id];
        };
    };

    _ju.extend(root.jsPlumbInstance, _ju.EventGenerator, {
        setAttribute: function (el, a, v) {
            this.setAttribute(el, a, v);
        },
        getAttribute: function (el, a) {
            return this.getAttribute(root.jsPlumb.getElement(el), a);
        },
        convertToFullOverlaySpec: function(spec) {
            if (_ju.isString(spec)) {
                spec = [ spec, { } ];
            }
            spec[1].id = spec[1].id || _ju.uuid();
            return spec;
        },
        registerConnectionType: function (id, type) {
            this._connectionTypes[id] = root.jsPlumb.extend({}, type);
            if (type.overlays) {
                var to = {};
                for (var i = 0; i < type.overlays.length; i++) {
                    // if a string, convert to object representation so that we can store the typeid on it.
                    // also assign an id.
                    var fo = this.convertToFullOverlaySpec(type.overlays[i]);
                    to[fo[1].id] = fo;
                }
                this._connectionTypes[id].overlays = to;
            }
        },
        registerConnectionTypes: function (types) {
            for (var i in types) {
                this.registerConnectionType(i, types[i]);
            }
        },
        registerEndpointType: function (id, type) {
            this._endpointTypes[id] = root.jsPlumb.extend({}, type);
            if (type.overlays) {
                var to = {};
                for (var i = 0; i < type.overlays.length; i++) {
                    // if a string, convert to object representation so that we can store the typeid on it.
                    // also assign an id.
                    var fo = this.convertToFullOverlaySpec(type.overlays[i]);
                    to[fo[1].id] = fo;
                }
                this._endpointTypes[id].overlays = to;
            }
        },
        registerEndpointTypes: function (types) {
            for (var i in types) {
                this.registerEndpointType(i, types[i]);
            }
        },
        getType: function (id, typeDescriptor) {
            return typeDescriptor === "connection" ? this._connectionTypes[id] : this._endpointTypes[id];
        },
        setIdChanged: function (oldId, newId) {
            this.setId(oldId, newId, true);
        },
        // set parent: change the parent for some node and update all the registrations we need to.
        setParent: function (el, newParent) {
            var _dom = this.getElement(el),
                _id = this.getId(_dom),
                _pdom = this.getElement(newParent),
                _pid = this.getId(_pdom),
                dm = this.getDragManager();

            _dom.parentNode.removeChild(_dom);
            _pdom.appendChild(_dom);
            if (dm) {
                dm.setParent(_dom, _id, _pdom, _pid);
            }
        },
        extend: function (o1, o2, names) {
            var i;
            if (names) {
                for (i = 0; i < names.length; i++) {
                    o1[names[i]] = o2[names[i]];
                }
            }
            else {
                for (i in o2) {
                    o1[i] = o2[i];
                }
            }

            return o1;
        },
        floatingConnections: {},
        getFloatingAnchorIndex: function (jpc) {
            return jpc.endpoints[0].isFloating() ? 0 : jpc.endpoints[1].isFloating() ? 1 : -1;
        }
    });

// --------------------- static instance + module registration -------------------------------------------

// create static instance and assign to window if window exists.
    var jsPlumb = new jsPlumbInstance();
    // register on 'root' (lets us run on server or browser)
    root.jsPlumb = jsPlumb;
    // add 'getInstance' method to static instance
    jsPlumb.getInstance = function (_defaults, overrideFns) {
        var j = new jsPlumbInstance(_defaults);
        if (overrideFns) {
            for (var ovf in overrideFns) {
                j[ovf] = overrideFns[ovf];
            }
        }
        j.init();
        return j;
    };
    jsPlumb.each = function (spec, fn) {
        if (spec == null) {
            return;
        }
        if (typeof spec === "string") {
            fn(jsPlumb.getElement(spec));
        }
        else if (spec.length != null) {
            for (var i = 0; i < spec.length; i++) {
                fn(jsPlumb.getElement(spec[i]));
            }
        }
        else {
            fn(spec);
        } // assume it's an element.
    };

    // CommonJS
    if (typeof exports !== 'undefined') {
        exports.jsPlumb = jsPlumb;
    }

// --------------------- end static instance + AMD registration -------------------------------------------

}).call(typeof window !== 'undefined' ? window : this);

/*
 * 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;(function() {

    "use strict";
    var root = this, _jp = root.jsPlumb, _ju = root.jsPlumbUtil;

    // ------------------------------ BEGIN OverlayCapablejsPlumbUIComponent --------------------------------------------

    var _internalLabelOverlayId = "__label",
    // this is a shortcut helper method to let people add a label as
    // overlay.
        _makeLabelOverlay = function (component, params) {

            var _params = {
                    cssClass: params.cssClass,
                    labelStyle: component.labelStyle,
                    id: _internalLabelOverlayId,
                    component: component,
                    _jsPlumb: component._jsPlumb.instance  // TODO not necessary, since the instance can be accessed through the component.
                },
                mergedParams = _jp.extend(_params, params);

            return new _jp.Overlays[component._jsPlumb.instance.getRenderMode()].Label(mergedParams);
        },
        _processOverlay = function (component, o) {
            var _newOverlay = null;
            if (_ju.isArray(o)) {	// this is for the shorthand ["Arrow", { width:50 }] syntax
                // there's also a three arg version:
                // ["Arrow", { width:50 }, {location:0.7}]
                // which merges the 3rd arg into the 2nd.
                var type = o[0],
                // make a copy of the object so as not to mess up anyone else's reference...
                    p = _jp.extend({component: component, _jsPlumb: component._jsPlumb.instance}, o[1]);
                if (o.length === 3) {
                    _jp.extend(p, o[2]);
                }
                _newOverlay = new _jp.Overlays[component._jsPlumb.instance.getRenderMode()][type](p);
            } else if (o.constructor === String) {
                _newOverlay = new _jp.Overlays[component._jsPlumb.instance.getRenderMode()][o]({component: component, _jsPlumb: component._jsPlumb.instance});
            } else {
                _newOverlay = o;
            }

            _newOverlay.id = _newOverlay.id || _ju.uuid();
            component.cacheTypeItem("overlay", _newOverlay, _newOverlay.id);
            component._jsPlumb.overlays[_newOverlay.id] = _newOverlay;

            return _newOverlay;
        };

    _jp.OverlayCapableJsPlumbUIComponent = function (params) {

        root.jsPlumbUIComponent.apply(this, arguments);
        this._jsPlumb.overlays = {};
        this._jsPlumb.overlayPositions = {};

        if (params.label) {
            this.getDefaultType().overlays[_internalLabelOverlayId] = ["Label", {
                label: params.label,
                location: params.labelLocation || this.defaultLabelLocation || 0.5,
                labelStyle: params.labelStyle || this._jsPlumb.instance.Defaults.LabelStyle,
                id:_internalLabelOverlayId
            }];
        }

        this.setListenerComponent = function (c) {
            if (this._jsPlumb) {
                for (var i in this._jsPlumb.overlays) {
                    this._jsPlumb.overlays[i].setListenerComponent(c);
                }
            }
        };
    };

    _jp.OverlayCapableJsPlumbUIComponent.applyType = function (component, t) {
        if (t.overlays) {
            // loop through the ones in the type. if already present on the component,
            // dont remove or re-add.
            var keep = {}, i;

            for (i in t.overlays) {

                var existing = component._jsPlumb.overlays[t.overlays[i][1].id];
                if (existing) {
                    // maybe update from data, if there were parameterised values for instance.
                    existing.updateFrom(t.overlays[i][1]);
                    keep[t.overlays[i][1].id] = true;
                }
                else {
                    var c = component.getCachedTypeItem("overlay", t.overlays[i][1].id);
                    if (c != null) {
                        c.reattach(component._jsPlumb.instance, component);
                        c.setVisible(true);
                        // maybe update from data, if there were parameterised values for instance.
                        c.updateFrom(t.overlays[i][1]);
                        component._jsPlumb.overlays[c.id] = c;
                    }
                    else {
                        c = component.addOverlay(t.overlays[i], true);
                    }
                    keep[c.id] = true;
                }
            }

            // now loop through the full overlays and remove those that we dont want to keep
            for (i in component._jsPlumb.overlays) {
                if (keep[component._jsPlumb.overlays[i].id] == null) {
                    component.removeOverlay(component._jsPlumb.overlays[i].id, true); // remove overlay but dont clean it up.
                    // that would remove event listeners etc; overlays are never discarded by the types stuff, they are
                    // just detached/reattached.
                }
            }
        }
    };

    _ju.extend(_jp.OverlayCapableJsPlumbUIComponent, root.jsPlumbUIComponent, {

        setHover: function (hover, ignoreAttachedElements) {
            if (this._jsPlumb && !this._jsPlumb.instance.isConnectionBeingDragged()) {
                for (var i in this._jsPlumb.overlays) {
                    this._jsPlumb.overlays[i][hover ? "addClass" : "removeClass"](this._jsPlumb.instance.hoverClass);
                }
            }
        },
        addOverlay: function (overlay, doNotRepaint) {
            var o = _processOverlay(this, overlay);
            if (!doNotRepaint) {
                this.repaint();
            }
            return o;
        },
        getOverlay: function (id) {
            return this._jsPlumb.overlays[id];
        },
        getOverlays: function () {
            return this._jsPlumb.overlays;
        },
        hideOverlay: function (id) {
            var o = this.getOverlay(id);
            if (o) {
                o.hide();
            }
        },
        hideOverlays: function () {
            for (var i in this._jsPlumb.overlays) {
                this._jsPlumb.overlays[i].hide();
            }
        },
        showOverlay: function (id) {
            var o = this.getOverlay(id);
            if (o) {
                o.show();
            }
        },
        showOverlays: function () {
            for (var i in this._jsPlumb.overlays) {
                this._jsPlumb.overlays[i].show();
            }
        },
        removeAllOverlays: function (doNotRepaint) {
            for (var i in this._jsPlumb.overlays) {
                if (this._jsPlumb.overlays[i].cleanup) {
                    this._jsPlumb.overlays[i].cleanup();
                }
            }

            this._jsPlumb.overlays = {};
            this._jsPlumb.overlayPositions = null;
            this._jsPlumb.overlayPlacements= {};
            if (!doNotRepaint) {
                this.repaint();
            }
        },
        removeOverlay: function (overlayId, dontCleanup) {
            var o = this._jsPlumb.overlays[overlayId];
            if (o) {
                o.setVisible(false);
                if (!dontCleanup && o.cleanup) {
                    o.cleanup();
                }
                delete this._jsPlumb.overlays[overlayId];
                if (this._jsPlumb.overlayPositions) {
                    delete this._jsPlumb.overlayPositions[overlayId];
                }

                if (this._jsPlumb.overlayPlacements) {
                    delete this._jsPlumb.overlayPlacements[overlayId];
                }
            }
        },
        removeOverlays: function () {
            for (var i = 0, j = arguments.length; i < j; i++) {
                this.removeOverlay(arguments[i]);
            }
        },
        moveParent: function (newParent) {
            if (this.bgCanvas) {
                this.bgCanvas.parentNode.removeChild(this.bgCanvas);
                newParent.appendChild(this.bgCanvas);
            }

            if (this.canvas && this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
                newParent.appendChild(this.canvas);

                for (var i in this._jsPlumb.overlays) {
                    if (this._jsPlumb.overlays[i].isAppendedAtTopLevel) {
                        var el = this._jsPlumb.overlays[i].getElement();
                        el.parentNode.removeChild(el);
                        newParent.appendChild(el);
                    }
                }
            }
        },
        getLabel: function () {
            var lo = this.getOverlay(_internalLabelOverlayId);
            return lo != null ? lo.getLabel() : null;
        },
        getLabelOverlay: function () {
            return this.getOverlay(_internalLabelOverlayId);
        },
        setLabel: function (l) {
            var lo = this.getOverlay(_internalLabelOverlayId);
            if (!lo) {
                var params = l.constructor === String || l.constructor === Function ? { label: l } : l;
                lo = _makeLabelOverlay(this, params);
                this._jsPlumb.overlays[_internalLabelOverlayId] = lo;
            }
            else {
                if (l.constructor === String || l.constructor === Function) {
                    lo.setLabel(l);
                }
                else {
                    if (l.label) {
                        lo.setLabel(l.label);
                    }
                    if (l.location) {
                        lo.setLocation(l.location);
                    }
                }
            }

            if (!this._jsPlumb.instance.isSuspendDrawing()) {
                this.repaint();
            }
        },
        cleanup: function (force) {
            for (var i in this._jsPlumb.overlays) {
                this._jsPlumb.overlays[i].cleanup(force);
                this._jsPlumb.overlays[i].destroy(force);
            }
            if (force) {
                this._jsPlumb.overlays = {};
                this._jsPlumb.overlayPositions = null;
            }
        },
        setVisible: function (v) {
            this[v ? "showOverlays" : "hideOverlays"]();
        },
        setAbsoluteOverlayPosition: function (overlay, xy) {
            this._jsPlumb.overlayPositions[overlay.id] = xy;
        },
        getAbsoluteOverlayPosition: function (overlay) {
            return this._jsPlumb.overlayPositions ? this._jsPlumb.overlayPositions[overlay.id] : null;
        },
        _clazzManip:function(action, clazz, dontUpdateOverlays) {
            if (!dontUpdateOverlays) {
                for (var i in this._jsPlumb.overlays) {
                    this._jsPlumb.overlays[i][action + "Class"](clazz);
                }
            }
        },
        addClass:function(clazz, dontUpdateOverlays) {
            this._clazzManip("add", clazz, dontUpdateOverlays);
        },
        removeClass:function(clazz, dontUpdateOverlays) {
            this._clazzManip("remove", clazz, dontUpdateOverlays);
        }
    });

// ------------------------------ END OverlayCapablejsPlumbUIComponent --------------------------------------------

}).call(typeof window !== 'undefined' ? window : this);

/*
 * This file contains the code for Endpoints.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 * 
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 * 
 * Dual licensed under the MIT and GPL2 licenses.
 */
;(function () {

    "use strict";
    var root = this, _jp = root.jsPlumb, _ju = root.jsPlumbUtil;

    // create the drag handler for a connection
    var _makeConnectionDragHandler = function (endpoint, placeholder, _jsPlumb) {
        var stopped = false;
        return {
            drag: function () {
                if (stopped) {
                    stopped = false;
                    return true;
                }

                if (placeholder.element) {
                    var _ui = _jsPlumb.getUIPosition(arguments, _jsPlumb.getZoom());
                    if (_ui != null) {
                        _jsPlumb.setPosition(placeholder.element, _ui);
                    }
                    _jsPlumb.repaint(placeholder.element, _ui);
                    // always repaint the source endpoint, because only continuous/dynamic anchors cause the endpoint
                    // to be repainted, so static anchors need to be told (or the endpoint gets dragged around)
                    endpoint.paint({anchorPoint:endpoint.anchor.getCurrentLocation({element:endpoint})});
                }
            },
            stopDrag: function () {
                stopped = true;
            }
        };
    };

    // creates a placeholder div for dragging purposes, adds it, and pre-computes its offset.
    var _makeDraggablePlaceholder = function (placeholder, _jsPlumb, ipco, ips) {
        var n = _jsPlumb.createElement("div", { position : "absolute" });
        _jsPlumb.appendElement(n);
        var id = _jsPlumb.getId(n);
        _jsPlumb.setPosition(n, ipco);
        n.style.width = ips[0] + "px";
        n.style.height = ips[1] + "px";
        _jsPlumb.manage(id, n, true); // TRANSIENT MANAGE
        // create and assign an id, and initialize the offset.
        placeholder.id = id;
        placeholder.element = n;
    };

    // create a floating endpoint (for drag connections)
    var _makeFloatingEndpoint = function (paintStyle, referenceAnchor, endpoint, referenceCanvas, sourceElement, _jsPlumb, _newEndpoint, scope) {
        var floatingAnchor = new _jp.FloatingAnchor({ reference: referenceAnchor, referenceCanvas: referenceCanvas, jsPlumbInstance: _jsPlumb });
        //setting the scope here should not be the way to fix that mootools issue.  it should be fixed by not
        // adding the floating endpoint as a droppable.  that makes more sense anyway!
        // TRANSIENT MANAGE
        return _newEndpoint({
            paintStyle: paintStyle,
            endpoint: endpoint,
            anchor: floatingAnchor,
            source: sourceElement,
            scope: scope
        });
    };

    var typeParameters = [ "connectorStyle", "connectorHoverStyle", "connectorOverlays",
        "connector", "connectionType", "connectorClass", "connectorHoverClass" ];

    // a helper function that tries to find a connection to the given element, and returns it if so. if elementWithPrecedence is null,
    // or no connection to it is found, we return the first connection in our list.
    var findConnectionToUseForDynamicAnchor = function (ep, elementWithPrecedence) {
        var idx = 0;
        if (elementWithPrecedence != null) {
            for (var i = 0; i < ep.connections.length; i++) {
                if (ep.connections[i].sourceId === elementWithPrecedence || ep.connections[i].targetId === elementWithPrecedence) {
                    idx = i;
                    break;
                }
            }
        }

        return ep.connections[idx];
    };

    _jp.Endpoint = function (params) {
        var _jsPlumb = params._jsPlumb,
            _newConnection = params.newConnection,
            _newEndpoint = params.newEndpoint;

        this.idPrefix = "_jsplumb_e_";
        this.defaultLabelLocation = [ 0.5, 0.5 ];
        this.defaultOverlayKeys = ["Overlays", "EndpointOverlays"];
        _jp.OverlayCapableJsPlumbUIComponent.apply(this, arguments);

// TYPE

        this.appendToDefaultType({
            connectionType:params.connectionType,
            maxConnections: params.maxConnections == null ? this._jsPlumb.instance.Defaults.MaxConnections : params.maxConnections, // maximum number of connections this endpoint can be the source of.,
            paintStyle: params.endpointStyle || params.paintStyle || params.style || this._jsPlumb.instance.Defaults.EndpointStyle || _jp.Defaults.EndpointStyle,
            hoverPaintStyle: params.endpointHoverStyle || params.hoverPaintStyle || this._jsPlumb.instance.Defaults.EndpointHoverStyle || _jp.Defaults.EndpointHoverStyle,
            connectorStyle: params.connectorStyle,
            connectorHoverStyle: params.connectorHoverStyle,
            connectorClass: params.connectorClass,
            connectorHoverClass: params.connectorHoverClass,
            connectorOverlays: params.connectorOverlays,
            connector: params.connector,
            connectorTooltip: params.connectorTooltip
        });

// END TYPE

        this._jsPlumb.enabled = !(params.enabled === false);
        this._jsPlumb.visible = true;
        this.element = _jp.getElement(params.source);
        this._jsPlumb.uuid = params.uuid;
        this._jsPlumb.floatingEndpoint = null;
        var inPlaceCopy = null;
        if (this._jsPlumb.uuid) {
            params.endpointsByUUID[this._jsPlumb.uuid] = this;
        }
        this.elementId = params.elementId;
        this.dragProxy = params.dragProxy;

        this._jsPlumb.connectionCost = params.connectionCost;
        this._jsPlumb.connectionsDirected = params.connectionsDirected;
        this._jsPlumb.currentAnchorClass = "";
        this._jsPlumb.events = {};

        var deleteOnEmpty = params.deleteOnEmpty === true;
        this.setDeleteOnEmpty = function(d) {
            deleteOnEmpty = d;
        };

        var _updateAnchorClass = function () {
            // stash old, get new
            var oldAnchorClass = _jsPlumb.endpointAnchorClassPrefix + "-" + this._jsPlumb.currentAnchorClass;
            this._jsPlumb.currentAnchorClass = this.anchor.getCssClass();
            var anchorClass = _jsPlumb.endpointAnchorClassPrefix + (this._jsPlumb.currentAnchorClass ? "-" + this._jsPlumb.currentAnchorClass : "");

            this.removeClass(oldAnchorClass);
            this.addClass(anchorClass);
            // add and remove at the same time to reduce the number of reflows.
            _jp.updateClasses(this.element, anchorClass, oldAnchorClass);
        }.bind(this);

        this.prepareAnchor = function(anchorParams) {
            var a = this._jsPlumb.instance.makeAnchor(anchorParams, this.elementId, _jsPlumb);
            a.bind("anchorChanged", function (currentAnchor) {
                this.fire("anchorChanged", {endpoint: this, anchor: currentAnchor});
                _updateAnchorClass();
            }.bind(this));
            return a;
        };

        this.setPreparedAnchor = function(anchor, doNotRepaint) {
            this._jsPlumb.instance.continuousAnchorFactory.clear(this.elementId);
            this.anchor = anchor;
            _updateAnchorClass();

            if (!doNotRepaint) {
                this._jsPlumb.instance.repaint(this.elementId);
            }

            return this;
        };

        this.setAnchor = function (anchorParams, doNotRepaint) {
            var a = this.prepareAnchor(anchorParams);
            this.setPreparedAnchor(a, doNotRepaint);
            return this;
        };

        var internalHover = function (state) {
            if (this.connections.length > 0) {
                for (var i = 0; i < this.connections.length; i++) {
                    this.connections[i].setHover(state, false);
                }
            }
            else {
                this.setHover(state);
            }
        }.bind(this);

        this.bind("mouseover", function () {
            internalHover(true);
        });
        this.bind("mouseout", function () {
            internalHover(false);
        });

        // ANCHOR MANAGER
        if (!params._transient) { // in place copies, for example, are transient.  they will never need to be retrieved during a paint cycle, because they dont move, and then they are deleted.
            this._jsPlumb.instance.anchorManager.add(this, this.elementId);
        }

        this.prepareEndpoint = function(ep, typeId) {
            var _e = function (t, p) {
                var rm = _jsPlumb.getRenderMode();
                if (_jp.Endpoints[rm][t]) {
                    return new _jp.Endpoints[rm][t](p);
                }
                if (!_jsPlumb.Defaults.DoNotThrowErrors) {
                    throw { msg: "jsPlumb: unknown endpoint type '" + t + "'" };
                }
            };

            var endpointArgs = {
                _jsPlumb: this._jsPlumb.instance,
                cssClass: params.cssClass,
                container: params.container,
                tooltip: params.tooltip,
                connectorTooltip: params.connectorTooltip,
                endpoint: this
            };

            var endpoint;

            if (_ju.isString(ep)) {
                endpoint = _e(ep, endpointArgs);
            }
            else if (_ju.isArray(ep)) {
                endpointArgs = _ju.merge(ep[1], endpointArgs);
                endpoint = _e(ep[0], endpointArgs);
            }
            else {
                endpoint = ep.clone();
            }

            // assign a clone function using a copy of endpointArgs. this is used when a drag starts: the endpoint that was dragged is cloned,
            // and the clone is left in its place while the original one goes off on a magical journey.
            // the copy is to get around a closure problem, in which endpointArgs ends up getting shared by
            // the whole world.
            //var argsForClone = jsPlumb.extend({}, endpointArgs);
            endpoint.clone = function () {
                // TODO this, and the code above, can be refactored to be more dry.
                if (_ju.isString(ep)) {
                    return _e(ep, endpointArgs);
                }
                else if (_ju.isArray(ep)) {
                    endpointArgs = _ju.merge(ep[1], endpointArgs);
                    return _e(ep[0], endpointArgs);
                }
            }.bind(this);

            endpoint.typeId = typeId;
            return endpoint;
        };

        this.setEndpoint = function(ep, doNotRepaint) {
            var _ep = this.prepareEndpoint(ep);
            this.setPreparedEndpoint(_ep, true);
        };

        this.setPreparedEndpoint = function (ep, doNotRepaint) {
            if (this.endpoint != null) {
                this.endpoint.cleanup();
                this.endpoint.destroy();
            }
            this.endpoint = ep;
            this.type = this.endpoint.type;
            this.canvas = this.endpoint.canvas;
        };

        _jp.extend(this, params, typeParameters);

        this.isSource = params.isSource || false;
        this.isTemporarySource = params.isTemporarySource || false;
        this.isTarget = params.isTarget || false;

        this.connections = params.connections || [];
        this.connectorPointerEvents = params["connector-pointer-events"];

        this.scope = params.scope || _jsPlumb.getDefaultScope();
        this.timestamp = null;
        this.reattachConnections = params.reattach || _jsPlumb.Defaults.ReattachConnections;
        this.connectionsDetachable = _jsPlumb.Defaults.ConnectionsDetachable;
        if (params.connectionsDetachable === false || params.detachable === false) {
            this.connectionsDetachable = false;
        }
        this.dragAllowedWhenFull = params.dragAllowedWhenFull !== false;

        if (params.onMaxConnections) {
            this.bind("maxConnections", params.onMaxConnections);
        }

        //
        // add a connection. not part of public API.
        //
        this.addConnection = function (connection) {
            this.connections.push(connection);
            this[(this.connections.length > 0 ? "add" : "remove") + "Class"](_jsPlumb.endpointConnectedClass);
            this[(this.isFull() ? "add" : "remove") + "Class"](_jsPlumb.endpointFullClass);
        };

        this.detachFromConnection = function (connection, idx, doNotCleanup) {
            idx = idx == null ? this.connections.indexOf(connection) : idx;
            if (idx >= 0) {
                this.connections.splice(idx, 1);
                this[(this.connections.length > 0 ? "add" : "remove") + "Class"](_jsPlumb.endpointConnectedClass);
                this[(this.isFull() ? "add" : "remove") + "Class"](_jsPlumb.endpointFullClass);
            }

            if (!doNotCleanup && deleteOnEmpty && this.connections.length === 0) {
                _jsPlumb.deleteObject({
                    endpoint: this,
                    fireEvent: false,
                    deleteAttachedObjects: doNotCleanup !== true
                });
            }
        };

        this.deleteEveryConnection = function(params) {
            var c = this.connections.length;
            for (var i = 0; i < c; i++) {
                _jsPlumb.deleteConnection(this.connections[0], params);
            }
        };

        this.detachFrom = function (targetEndpoint, fireEvent, originalEvent) {
            var c = [];
            for (var i = 0; i < this.connections.length; i++) {
                if (this.connections[i].endpoints[1] === targetEndpoint || this.connections[i].endpoints[0] === targetEndpoint) {
                    c.push(this.connections[i]);
                }
            }
            for (var j = 0, count = c.length; j < count; j++) {
                _jsPlumb.deleteConnection(c[0]);
            }
            return this;
        };

        this.getElement = function () {
            return this.element;
        };

        this.setElement = function (el) {
            var parentId = this._jsPlumb.instance.getId(el),
                curId = this.elementId;
            // remove the endpoint from the list for the current endpoint's element
            _ju.removeWithFunction(params.endpointsByElement[this.elementId], function (e) {
                return e.id === this.id;
            }.bind(this));
            this.element = _jp.getElement(el);
            this.elementId = _jsPlumb.getId(this.element);
            _jsPlumb.anchorManager.rehomeEndpoint(this, curId, this.element);
            _jsPlumb.dragManager.endpointAdded(this.element);
            _ju.addToList(params.endpointsByElement, parentId, this);
            return this;
        };

        /**
         * private but must be exposed.
         */
        this.makeInPlaceCopy = function () {
            var loc = this.anchor.getCurrentLocation({element: this}),
                o = this.anchor.getOrientation(this),
                acc = this.anchor.getCssClass(),
                inPlaceAnchor = {
                    bind: function () {
                    },
                    compute: function () {
                        return [ loc[0], loc[1] ];
                    },
                    getCurrentLocation: function () {
                        return [ loc[0], loc[1] ];
                    },
                    getOrientation: function () {
                        return o;
                    },
                    getCssClass: function () {
                        return acc;
                    }
                };

            return _newEndpoint({
                dropOptions: params.dropOptions,
                anchor: inPlaceAnchor,
                source: this.element,
                paintStyle: this.getPaintStyle(),
                endpoint: params.hideOnDrag ? "Blank" : this.endpoint,
                _transient: true,
                scope: this.scope,
                reference:this
            });
        };

        /**
         * returns a connection from the pool; used when dragging starts.  just gets the head of the array if it can.
         */
        this.connectorSelector = function () {
            return this.connections[0];
        };

        this.setStyle = this.setPaintStyle;

        this.paint = function (params) {
            params = params || {};
            var timestamp = params.timestamp, recalc = !(params.recalc === false);
            if (!timestamp || this.timestamp !== timestamp) {

                var info = _jsPlumb.updateOffset({ elId: this.elementId, timestamp: timestamp });

                var xy = params.offset ? params.offset.o : info.o;
                if (xy != null) {
                    var ap = params.anchorPoint, connectorPaintStyle = params.connectorPaintStyle;
                    if (ap == null) {
                        var wh = params.dimensions || info.s,
                            anchorParams = { xy: [ xy.left, xy.top ], wh: wh, element: this, timestamp: timestamp };
                        if (recalc && this.anchor.isDynamic && this.connections.length > 0) {
                            var c = findConnectionToUseForDynamicAnchor(this, params.elementWithPrecedence),
                                oIdx = c.endpoints[0] === this ? 1 : 0,
                                oId = oIdx === 0 ? c.sourceId : c.targetId,
                                oInfo = _jsPlumb.getCachedData(oId),
                                oOffset = oInfo.o, oWH = oInfo.s;

                            anchorParams.index = oIdx === 0 ? 1 : 0;
                            anchorParams.connection = c;
                            anchorParams.txy = [ oOffset.left, oOffset.top ];
                            anchorParams.twh = oWH;
                            anchorParams.tElement = c.endpoints[oIdx];
                        } else if (this.connections.length > 0) {
                            anchorParams.connection = this.connections[0];
                        }
                        ap = this.anchor.compute(anchorParams);
                    }

                    this.endpoint.compute(ap, this.anchor.getOrientation(this), this._jsPlumb.paintStyleInUse, connectorPaintStyle || this.paintStyleInUse);
                    this.endpoint.paint(this._jsPlumb.paintStyleInUse, this.anchor);
                    this.timestamp = timestamp;

                    // paint overlays
                    for (var i in this._jsPlumb.overlays) {
                        if (this._jsPlumb.overlays.hasOwnProperty(i)) {
                            var o = this._jsPlumb.overlays[i];
                            if (o.isVisible()) {
                                this._jsPlumb.overlayPlacements[i] = o.draw(this.endpoint, this._jsPlumb.paintStyleInUse);
                                o.paint(this._jsPlumb.overlayPlacements[i]);
                            }
                        }
                    }
                }
            }
        };

        this.getTypeDescriptor = function () {
            return "endpoint";
        };
        this.isVisible = function () {
            return this._jsPlumb.visible;
        };

        this.repaint = this.paint;

        var draggingInitialised = false;
        this.initDraggable = function () {

            // is this a connection source? we make it draggable and have the
            // drag listener maintain a connection with a floating endpoint.
            if (!draggingInitialised && _jp.isDragSupported(this.element)) {
                var placeholderInfo = { id: null, element: null },
                    jpc = null,
                    existingJpc = false,
                    existingJpcParams = null,
                    _dragHandler = _makeConnectionDragHandler(this, placeholderInfo, _jsPlumb),
                    dragOptions = params.dragOptions || {},
                    defaultOpts = {},
                    startEvent = _jp.dragEvents.start,
                    stopEvent = _jp.dragEvents.stop,
                    dragEvent = _jp.dragEvents.drag,
                    beforeStartEvent = _jp.dragEvents.beforeStart,
                    payload;

                // respond to beforeStart from katavorio; this will have, optionally, a payload of attribute values
                // that were placed there by the makeSource mousedown listener.
                var beforeStart = function(beforeStartParams) {
                    payload = beforeStartParams.e.payload || {};
                };

                var start = function (startParams) {

// -------------   first, get a connection to drag. this may be null, in which case we are dragging a new one.

                    jpc = this.connectorSelector();

// -------------------------------- now a bunch of tests about whether or not to proceed -------------------------

                    var _continue = true;
                    // if not enabled, return
                    if (!this.isEnabled()) {
                        _continue = false;
                    }
                    // if no connection and we're not a source - or temporarily a source, as is the case with makeSource - return.
                    if (jpc == null && !this.isSource && !this.isTemporarySource) {
                        _continue = false;
                    }
                    // otherwise if we're full and not allowed to drag, also return false.
                    if (this.isSource && this.isFull() && !(jpc != null && this.dragAllowedWhenFull)) {
                        _continue = false;
                    }
                    // if the connection was setup as not detachable or one of its endpoints
                    // was setup as connectionsDetachable = false, or Defaults.ConnectionsDetachable
                    // is set to false...
                    if (jpc != null && !jpc.isDetachable(this)) {
                        // .. and the endpoint is full
                        if (this.isFull()) {
                            _continue = false;
                        } else {
                            // otherwise, if not full, set the connection to null, and we will now proceed
                            // to drag a new connection.
                            jpc = null;
                        }
                    }

                    var beforeDrag = _jsPlumb.checkCondition(jpc == null ? "beforeDrag" : "beforeStartDetach", {
                        endpoint:this,
                        source:this.element,
                        sourceId:this.elementId,
                        connection:jpc
                    });
                    if (beforeDrag === false) {
                        _continue = false;
                    }
                    // else we might have been given some data. we'll pass it in to a new connection as 'data'.
                    // here we also merge in the optional payload we were given on mousedown.
                    else if (typeof beforeDrag === "object") {
                        _jp.extend(beforeDrag, payload || {});
                    }
                    else {
                        // or if no beforeDrag data, maybe use the payload on its own.
                        beforeDrag = payload || {};
                    }

                    if (_continue === false) {
                        // this is for mootools and yui. returning false from this causes jquery to stop drag.
                        // the events are wrapped in both mootools and yui anyway, but i don't think returning
                        // false from the start callback would stop a drag.
                        if (_jsPlumb.stopDrag) {
                            _jsPlumb.stopDrag(this.canvas);
                        }
                        _dragHandler.stopDrag();
                        return false;
                    }

// ---------------------------------------------------------------------------------------------------------------------

                    // ok to proceed.

                    // clear hover for all connections for this endpoint before continuing.
                    for (var i = 0; i < this.connections.length; i++) {
                        this.connections[i].setHover(false);
                    }

                    this.addClass("endpointDrag");
                    _jsPlumb.setConnectionBeingDragged(true);

                    // if we're not full but there was a connection, make it null. we'll create a new one.
                    if (jpc && !this.isFull() && this.isSource) {
                        jpc = null;
                    }

                    _jsPlumb.updateOffset({ elId: this.elementId });

// ----------------    make the element we will drag around, and position it -----------------------------

                    var ipco = this._jsPlumb.instance.getOffset(this.canvas),
                        canvasElement = this.canvas,
                        ips = this._jsPlumb.instance.getSize(this.canvas);

                    _makeDraggablePlaceholder(placeholderInfo, _jsPlumb, ipco, ips);

                    // store the id of the dragging div and the source element. the drop function will pick these up.                   
                    _jsPlumb.setAttributes(this.canvas, {
                        "dragId": placeholderInfo.id,
                        "elId": this.elementId
                    });

// ------------------- create an endpoint that will be our floating endpoint ------------------------------------

                    var endpointToFloat = this.dragProxy || this.endpoint;
                    if (this.dragProxy == null && this.connectionType != null) {
                        var aae = this._jsPlumb.instance.deriveEndpointAndAnchorSpec(this.connectionType);
                        if (aae.endpoints[1]) {
                            endpointToFloat = aae.endpoints[1];
                        }
                    }
                    var centerAnchor = this._jsPlumb.instance.makeAnchor("Center");
                    centerAnchor.isFloating = true;
                    this._jsPlumb.floatingEndpoint = _makeFloatingEndpoint(this.getPaintStyle(), centerAnchor, endpointToFloat, this.canvas, placeholderInfo.element, _jsPlumb, _newEndpoint, this.scope);
                    var _savedAnchor = this._jsPlumb.floatingEndpoint.anchor;


                    if (jpc == null) {

                        this.setHover(false, false);
                        // create a connection. one end is this endpoint, the other is a floating endpoint.                    
                        jpc = _newConnection({
                            sourceEndpoint: this,
                            targetEndpoint: this._jsPlumb.floatingEndpoint,
                            source: this.element,  // for makeSource with parent option.  ensure source element is represented correctly.
                            target: placeholderInfo.element,
                            anchors: [ this.anchor, this._jsPlumb.floatingEndpoint.anchor ],
                            paintStyle: params.connectorStyle, // this can be null. Connection will use the default.
                            hoverPaintStyle: params.connectorHoverStyle,
                            connector: params.connector, // this can also be null. Connection will use the default.
                            overlays: params.connectorOverlays,
                            type: this.connectionType,
                            cssClass: this.connectorClass,
                            hoverClass: this.connectorHoverClass,
                            scope:params.scope,
                            data:beforeDrag
                        });
                        jpc.pending = true;
                        jpc.addClass(_jsPlumb.draggingClass);
                        this._jsPlumb.floatingEndpoint.addClass(_jsPlumb.draggingClass);
                        this._jsPlumb.floatingEndpoint.anchor = _savedAnchor;
                        // fire an event that informs that a connection is being dragged
                        _jsPlumb.fire("connectionDrag", jpc);

                        // register the new connection on the drag manager. This connection, at this point, is 'pending',
                        // and has as its target a temporary element (the 'placeholder'). If the connection subsequently
                        // becomes established, the anchor manager is informed that the target of the connection has
                        // changed.

                        _jsPlumb.anchorManager.newConnection(jpc);

                    } else {
                        existingJpc = true;
                        jpc.setHover(false);
                        // new anchor idx
                        var anchorIdx = jpc.endpoints[0].id === this.id ? 0 : 1;
                        this.detachFromConnection(jpc, null, true);                         // detach from the connection while dragging is occurring. but dont cleanup automatically.

                        // store the original scope (issue 57)
                        var dragScope = _jsPlumb.getDragScope(canvasElement);
                        _jsPlumb.setAttribute(this.canvas, "originalScope", dragScope);

                        // fire an event that informs that a connection is being dragged. we do this before
                        // replacing the original target with the floating element info.
                        _jsPlumb.fire("connectionDrag", jpc);

                        // now we replace ourselves with the temporary div we created above:
                        if (anchorIdx === 0) {
                            existingJpcParams = [ jpc.source, jpc.sourceId, canvasElement, dragScope ];
                            _jsPlumb.anchorManager.sourceChanged(jpc.endpoints[anchorIdx].elementId, placeholderInfo.id, jpc, placeholderInfo.element);

                        } else {
                            existingJpcParams = [ jpc.target, jpc.targetId, canvasElement, dragScope ];
                            jpc.target = placeholderInfo.element;
                            jpc.targetId = placeholderInfo.id;

                            _jsPlumb.anchorManager.updateOtherEndpoint(jpc.sourceId, jpc.endpoints[anchorIdx].elementId, jpc.targetId, jpc);
                        }

                        // store the original endpoint and assign the new floating endpoint for the drag.
                        jpc.suspendedEndpoint = jpc.endpoints[anchorIdx];

                        // PROVIDE THE SUSPENDED ELEMENT, BE IT A SOURCE OR TARGET (ISSUE 39)
                        jpc.suspendedElement = jpc.endpoints[anchorIdx].getElement();
                        jpc.suspendedElementId = jpc.endpoints[anchorIdx].elementId;
                        jpc.suspendedElementType = anchorIdx === 0 ? "source" : "target";

                        jpc.suspendedEndpoint.setHover(false);
                        this._jsPlumb.floatingEndpoint.referenceEndpoint = jpc.suspendedEndpoint;
                        jpc.endpoints[anchorIdx] = this._jsPlumb.floatingEndpoint;

                        jpc.addClass(_jsPlumb.draggingClass);
                        this._jsPlumb.floatingEndpoint.addClass(_jsPlumb.draggingClass);
                    }

                    _jsPlumb.registerFloatingConnection(placeholderInfo, jpc, this._jsPlumb.floatingEndpoint);

                    // // register it and register connection on it.
                    // _jsPlumb.floatingConnections[placeholderInfo.id] = jpc;
                    //
                    // // only register for the target endpoint; we will not be dragging the source at any time
                    // // before this connection is either discarded or made into a permanent connection.
                    // _ju.addToList(params.endpointsByElement, placeholderInfo.id, this._jsPlumb.floatingEndpoint);


                    // tell jsplumb about it
                    _jsPlumb.currentlyDragging = true;
                }.bind(this);

                var stop = function () {
                    _jsPlumb.setConnectionBeingDragged(false);

                    if (jpc && jpc.endpoints != null) {
                        // get the actual drop event (decode from library args to stop function)
                        var originalEvent = _jsPlumb.getDropEvent(arguments);
                        // unlock the other endpoint (if it is dynamic, it would have been locked at drag start)
                        var idx = _jsPlumb.getFloatingAnchorIndex(jpc);
                        jpc.endpoints[idx === 0 ? 1 : 0].anchor.unlock();
                        // TODO: Dont want to know about css classes inside jsplumb, ideally.
                        jpc.removeClass(_jsPlumb.draggingClass);

                        // if we have the floating endpoint then the connection has not been dropped
                        // on another endpoint.  If it is a new connection we throw it away. If it is an
                        // existing connection we check to see if we should reattach it, throwing it away
                        // if not.
                        if (this._jsPlumb && (jpc.deleteConnectionNow || jpc.endpoints[idx] === this._jsPlumb.floatingEndpoint)) {
                            // 6a. if the connection was an existing one...
                            if (existingJpc && jpc.suspendedEndpoint) {
                                // fix for issue35, thanks Sylvain Gizard: when firing the detach event make sure the
                                // floating endpoint has been replaced.
                                if (idx === 0) {
                                    jpc.floatingElement = jpc.source;
                                    jpc.floatingId = jpc.sourceId;
                                    jpc.floatingEndpoint = jpc.endpoints[0];
                                    jpc.floatingIndex = 0;
                                    jpc.source = existingJpcParams[0];
                                    jpc.sourceId = existingJpcParams[1];
                                } else {
                                    // keep a copy of the floating element; the anchor manager will want to clean up.
                                    jpc.floatingElement = jpc.target;
                                    jpc.floatingId = jpc.targetId;
                                    jpc.floatingEndpoint = jpc.endpoints[1];
                                    jpc.floatingIndex = 1;
                                    jpc.target = existingJpcParams[0];
                                    jpc.targetId = existingJpcParams[1];
                                }

                                var fe = this._jsPlumb.floatingEndpoint; // store for later removal.
                                // restore the original scope (issue 57)
                                _jsPlumb.setDragScope(existingJpcParams[2], existingJpcParams[3]);
                                jpc.endpoints[idx] = jpc.suspendedEndpoint;
                                // if the connection should be reattached, or the other endpoint refuses detach, then
                                // reset the connection to its original state
                                if (jpc.isReattach() || jpc._forceReattach || jpc._forceDetach || !_jsPlumb.deleteConnection(jpc, {originalEvent: originalEvent})) {

                                    jpc.setHover(false);
                                    jpc._forceDetach = null;
                                    jpc._forceReattach = null;
                                    this._jsPlumb.floatingEndpoint.detachFromConnection(jpc);
                                    jpc.suspendedEndpoint.addConnection(jpc);

                                    // TODO this code is duplicated in lots of places...and there is nothing external
                                    // in the code; it all refers to the connection itself. we could add a
                                    // `checkSanity(connection)` method to anchorManager that did this.
                                    if (idx === 1) {
                                        _jsPlumb.anchorManager.updateOtherEndpoint(jpc.sourceId, jpc.floatingId, jpc.targetId, jpc);
                                    }
                                    else {
                                        _jsPlumb.anchorManager.sourceChanged(jpc.floatingId, jpc.sourceId, jpc, jpc.source);
                                    }

                                    _jsPlumb.repaint(existingJpcParams[1]);
                                }
                                else {
                                    _jsPlumb.deleteObject({endpoint: fe});
                                }
                            }
                        }

                        // makeTargets sets this flag, to tell us we have been replaced and should delete this object.
                        if (this.deleteAfterDragStop) {
                            _jsPlumb.deleteObject({endpoint: this});
                        }
                        else {
                            if (this._jsPlumb) {
                                 this.paint({recalc: false});
                            }
                        }

                        // although the connection is no longer valid, there are use cases where this is useful.
                        _jsPlumb.fire("connectionDragStop", jpc, originalEvent);
                        // fire this event to give people more fine-grained control (connectionDragStop fires a lot)
                        if (jpc.pending) {
                            _jsPlumb.fire("connectionAborted", jpc, originalEvent);
                        }
                        // tell jsplumb that dragging is finished.
                        _jsPlumb.currentlyDragging = false;
                        jpc.suspendedElement = null;
                        jpc.suspendedEndpoint = null;
                        jpc = null;
                    }

                    // if no endpoints, jpc already cleaned up. but still we want to ensure we're reset properly.
                    // remove the element associated with the floating endpoint
                    // (and its associated floating endpoint and visual artefacts)
                    if (placeholderInfo && placeholderInfo.element) {
                        _jsPlumb.remove(placeholderInfo.element, false, false);
                    }
                    // remove the inplace copy
                    if (inPlaceCopy) {
                        _jsPlumb.deleteObject({endpoint: inPlaceCopy});
                    }

                    if (this._jsPlumb) {
                        // make our canvas visible (TODO: hand off to library; we should not know about DOM)
                        this.canvas.style.visibility = "visible";
                        // unlock our anchor
                        this.anchor.unlock();
                        // clear floating anchor.
                        this._jsPlumb.floatingEndpoint = null;
                    }

                }.bind(this);

                dragOptions = _jp.extend(defaultOpts, dragOptions);
                dragOptions.scope = this.scope || dragOptions.scope;
                dragOptions[beforeStartEvent] = _ju.wrap(dragOptions[beforeStartEvent], beforeStart, false);
                dragOptions[startEvent] = _ju.wrap(dragOptions[startEvent], start, false);
                // extracted drag handler function so can be used by makeSource
                dragOptions[dragEvent] = _ju.wrap(dragOptions[dragEvent], _dragHandler.drag);
                dragOptions[stopEvent] = _ju.wrap(dragOptions[stopEvent], stop);
                dragOptions.multipleDrop = false;

                dragOptions.canDrag = function () {
                    return this.isSource || this.isTemporarySource || (this.connections.length > 0 && this.connectionsDetachable !== false);
                }.bind(this);

                _jsPlumb.initDraggable(this.canvas, dragOptions, "internal");

                this.canvas._jsPlumbRelatedElement = this.element;

                draggingInitialised = true;
            }
        };

        var ep = params.endpoint || this._jsPlumb.instance.Defaults.Endpoint || _jp.Defaults.Endpoint;
        this.setEndpoint(ep, true);
        var anchorParamsToUse = params.anchor ? params.anchor : params.anchors ? params.anchors : (_jsPlumb.Defaults.Anchor || "Top");
        this.setAnchor(anchorParamsToUse, true);

        // finally, set type if it was provided
        var type = [ "default", (params.type || "")].join(" ");
        this.addType(type, params.data, true);
        this.canvas = this.endpoint.canvas;
        this.canvas._jsPlumb = this;

        this.initDraggable();

        // pulled this out into a function so we can reuse it for the inPlaceCopy canvas; you can now drop detached connections
        // back onto the endpoint you detached it from.
        var _initDropTarget = function (canvas, isTransient, endpoint, referenceEndpoint) {

            if (_jp.isDropSupported(this.element)) {
                var dropOptions = params.dropOptions || _jsPlumb.Defaults.DropOptions || _jp.Defaults.DropOptions;
                dropOptions = _jp.extend({}, dropOptions);
                dropOptions.scope = dropOptions.scope || this.scope;
                var dropEvent = _jp.dragEvents.drop,
                    overEvent = _jp.dragEvents.over,
                    outEvent = _jp.dragEvents.out,
                    _ep = this,
                    drop = _jsPlumb.EndpointDropHandler({
                        getEndpoint: function () {
                            return _ep;
                        },
                        jsPlumb: _jsPlumb,
                        enabled: function () {
                            return endpoint != null ? endpoint.isEnabled() : true;
                        },
                        isFull: function () {
                            return endpoint.isFull();
                        },
                        element: this.element,
                        elementId: this.elementId,
                        isSource: this.isSource,
                        isTarget: this.isTarget,
                        addClass: function (clazz) {
                            _ep.addClass(clazz);
                        },
                        removeClass: function (clazz) {
                            _ep.removeClass(clazz);
                        },
                        isDropAllowed: function () {
                            return _ep.isDropAllowed.apply(_ep, arguments);
                        },
                        reference:referenceEndpoint,
                        isRedrop:function(jpc, dhParams) {
                            return jpc.suspendedEndpoint && dhParams.reference && (jpc.suspendedEndpoint.id === dhParams.reference.id);
                        }
                    });

                dropOptions[dropEvent] = _ju.wrap(dropOptions[dropEvent], drop, true);
                dropOptions[overEvent] = _ju.wrap(dropOptions[overEvent], function () {
                    var draggable = _jp.getDragObject(arguments),
                        id = _jsPlumb.getAttribute(_jp.getElement(draggable), "dragId"),
                        _jpc = _jsPlumb.getFloatingConnectionFor(id);//_jsPlumb.floatingConnections[id];

                    if (_jpc != null) {
                        var idx = _jsPlumb.getFloatingAnchorIndex(_jpc);
                        // here we should fire the 'over' event if we are a target and this is a new connection,
                        // or we are the same as the floating endpoint.
                        var _cont = (this.isTarget && idx !== 0) || (_jpc.suspendedEndpoint && this.referenceEndpoint && this.referenceEndpoint.id === _jpc.suspendedEndpoint.id);
                        if (_cont) {
                            var bb = _jsPlumb.checkCondition("checkDropAllowed", {
                                sourceEndpoint: _jpc.endpoints[idx],
                                targetEndpoint: this,
                                connection: _jpc
                            });
                            this[(bb ? "add" : "remove") + "Class"](_jsPlumb.endpointDropAllowedClass);
                            this[(bb ? "remove" : "add") + "Class"](_jsPlumb.endpointDropForbiddenClass);
                            _jpc.endpoints[idx].anchor.over(this.anchor, this);
                        }
                    }
                }.bind(this));

                dropOptions[outEvent] = _ju.wrap(dropOptions[outEvent], function () {
                    var draggable = _jp.getDragObject(arguments),
                        id = draggable == null ? null : _jsPlumb.getAttribute(_jp.getElement(draggable), "dragId"),
                        _jpc = id ? _jsPlumb.getFloatingConnectionFor(id) : null;

                    if (_jpc != null) {
                        var idx = _jsPlumb.getFloatingAnchorIndex(_jpc);
                        var _cont = (this.isTarget && idx !== 0) || (_jpc.suspendedEndpoint && this.referenceEndpoint && this.referenceEndpoint.id === _jpc.suspendedEndpoint.id);
                        if (_cont) {
                            this.removeClass(_jsPlumb.endpointDropAllowedClass);
                            this.removeClass(_jsPlumb.endpointDropForbiddenClass);
                            _jpc.endpoints[idx].anchor.out();
                        }
                    }
                }.bind(this));

                _jsPlumb.initDroppable(canvas, dropOptions, "internal", isTransient);
            }
        }.bind(this);

        // Initialise the endpoint's canvas as a drop target. The drop handler will take care of the logic of whether
        // something can actually be dropped.
        if (!this.anchor.isFloating) {
            _initDropTarget(this.canvas, !(params._transient || this.anchor.isFloating), this, params.reference);
        }

        return this;
    };

    _ju.extend(_jp.Endpoint, _jp.OverlayCapableJsPlumbUIComponent, {

        setVisible: function (v, doNotChangeConnections, doNotNotifyOtherEndpoint) {
            this._jsPlumb.visible = v;
            if (this.canvas) {
                this.canvas.style.display = v ? "block" : "none";
            }
            this[v ? "showOverlays" : "hideOverlays"]();
            if (!doNotChangeConnections) {
                for (var i = 0; i < this.connections.length; i++) {
                    this.connections[i].setVisible(v);
                    if (!doNotNotifyOtherEndpoint) {
                        var oIdx = this === this.connections[i].endpoints[0] ? 1 : 0;
                        // only change the other endpoint if this is its only connection.
                        if (this.connections[i].endpoints[oIdx].connections.length === 1) {
                            this.connections[i].endpoints[oIdx].setVisible(v, true, true);
                        }
                    }
                }
            }
        },
        getAttachedElements: function () {
            return this.connections;
        },
        applyType: function (t, doNotRepaint) {
            this.setPaintStyle(t.endpointStyle || t.paintStyle, doNotRepaint);
            this.setHoverPaintStyle(t.endpointHoverStyle || t.hoverPaintStyle, doNotRepaint);
            if (t.maxConnections != null) {
                this._jsPlumb.maxConnections = t.maxConnections;
            }
            if (t.scope) {
                this.scope = t.scope;
            }
            _jp.extend(this, t, typeParameters);
            if (t.cssClass != null && this.canvas) {
                this._jsPlumb.instance.addClass(this.canvas, t.cssClass);
            }
            _jp.OverlayCapableJsPlumbUIComponent.applyType(this, t);
        },
        isEnabled: function () {
            return this._jsPlumb.enabled;
        },
        setEnabled: function (e) {
            this._jsPlumb.enabled = e;
        },
        cleanup: function () {
            var anchorClass = this._jsPlumb.instance.endpointAnchorClassPrefix + (this._jsPlumb.currentAnchorClass ? "-" + this._jsPlumb.currentAnchorClass : "");
            _jp.removeClass(this.element, anchorClass);
            this.anchor = null;
            this.endpoint.cleanup(true);
            this.endpoint.destroy();
            this.endpoint = null;
            // drag/drop
            this._jsPlumb.instance.destroyDraggable(this.canvas, "internal");
            this._jsPlumb.instance.destroyDroppable(this.canvas, "internal");
        },
        setHover: function (h) {
            if (this.endpoint && this._jsPlumb && !this._jsPlumb.instance.isConnectionBeingDragged()) {
                this.endpoint.setHover(h);
            }
        },
        isFull: function () {
            return this._jsPlumb.maxConnections === 0 ? true : !(this.isFloating() || this._jsPlumb.maxConnections < 0 || this.connections.length < this._jsPlumb.maxConnections);
        },
        /**
         * private but needs to be exposed.
         */
        isFloating: function () {
            return this.anchor != null && this.anchor.isFloating;
        },
        isConnectedTo: function (endpoint) {
            var found = false;
            if (endpoint) {
                for (var i = 0; i < this.connections.length; i++) {
                    if (this.connections[i].endpoints[1] === endpoint || this.connections[i].endpoints[0] === endpoint) {
                        found = true;
                        break;
                    }
                }
            }
            return found;
        },
        getConnectionCost: function () {
            return this._jsPlumb.connectionCost;
        },
        setConnectionCost: function (c) {
            this._jsPlumb.connectionCost = c;
        },
        areConnectionsDirected: function () {
            return this._jsPlumb.connectionsDirected;
        },
        setConnectionsDirected: function (b) {
            this._jsPlumb.connectionsDirected = b;
        },
        setElementId: function (_elId) {
            this.elementId = _elId;
            this.anchor.elementId = _elId;
        },
        setReferenceElement: function (_el) {
            this.element = _jp.getElement(_el);
        },
        setDragAllowedWhenFull: function (allowed) {
            this.dragAllowedWhenFull = allowed;
        },
        equals: function (endpoint) {
            return this.anchor.equals(endpoint.anchor);
        },
        getUuid: function () {
            return this._jsPlumb.uuid;
        },
        computeAnchor: function (params) {
            return this.anchor.compute(params);
        }
    });

    root.jsPlumbInstance.prototype.EndpointDropHandler = function (dhParams) {
        return function (e) {

            var _jsPlumb = dhParams.jsPlumb;

            // remove the classes that are added dynamically. drop is neither forbidden nor allowed now that
            // the drop is finishing.
            dhParams.removeClass(_jsPlumb.endpointDropAllowedClass);
            dhParams.removeClass(_jsPlumb.endpointDropForbiddenClass);

            var originalEvent = _jsPlumb.getDropEvent(arguments),
                draggable = _jsPlumb.getDragObject(arguments),
                id = _jsPlumb.getAttribute(draggable, "dragId"),
                elId = _jsPlumb.getAttribute(draggable, "elId"),
                scope = _jsPlumb.getAttribute(draggable, "originalScope"),
                jpc = _jsPlumb.getFloatingConnectionFor(id);

            // if no active connection, bail.
            if (jpc == null) {
                return;
            }

            // calculate if this is an existing connection.
            var existingConnection = jpc.suspendedEndpoint != null;

            // if suspended endpoint exists but has been cleaned up, bail. This means it's an existing connection
            // that has been detached and will shortly be discarded.
            if (existingConnection && jpc.suspendedEndpoint._jsPlumb == null) {
                return;
            }

            // get the drop endpoint. for a normal connection this is just the one that would replace the currently
            // floating endpoint. for a makeTarget this is a new endpoint that is created on drop. But we leave that to
            // the handler to figure out.
            var _ep = dhParams.getEndpoint(jpc);

            // If we're not given an endpoint to use, bail.
            if (_ep == null) {
                return;
            }

            // if this is a drop back where the connection came from, mark it force reattach and
            // return; the stop handler will reattach. without firing an event.
            if (dhParams.isRedrop(jpc, dhParams)) {
                jpc._forceReattach = true;
                jpc.setHover(false);
                if (dhParams.maybeCleanup) {
                    dhParams.maybeCleanup(_ep);
                }
                return;
            }

            // ensure we dont bother trying to drop sources on non-source eps, and same for target.
            var idx = _jsPlumb.getFloatingAnchorIndex(jpc);
            if ((idx === 0 && !dhParams.isSource)|| (idx === 1 && !dhParams.isTarget)){
                if (dhParams.maybeCleanup) {
                    dhParams.maybeCleanup(_ep);
                }
                return;
            }

            if (dhParams.onDrop) {
                dhParams.onDrop(jpc);
            }

            // restore the original scope if necessary (issue 57)
            if (scope) {
                _jsPlumb.setDragScope(draggable, scope);
            }

            // if the target of the drop is full, fire an event (we abort below)
            // makeTarget: keep.
            var isFull = dhParams.isFull(e);
            if (isFull) {
                _ep.fire("maxConnections", {
                    endpoint: this,
                    connection: jpc,
                    maxConnections: _ep._jsPlumb.maxConnections
                }, originalEvent);
            }
            //
            // if endpoint enabled, not full, and matches the index of the floating endpoint...
            if (!isFull &&  dhParams.enabled()) {
                var _doContinue = true;

                // before testing for beforeDrop, reset the connection's source/target to be the actual DOM elements
                // involved (that is, stash any temporary stuff used for dragging. but we need to keep it around in
                // order that the anchor manager can clean things up properly).
                if (idx === 0) {
                    jpc.floatingElement = jpc.source;
                    jpc.floatingId = jpc.sourceId;
                    jpc.floatingEndpoint = jpc.endpoints[0];
                    jpc.floatingIndex = 0;
                    jpc.source = dhParams.element;
                    jpc.sourceId = dhParams.elementId;
                } else {
                    jpc.floatingElement = jpc.target;
                    jpc.floatingId = jpc.targetId;
                    jpc.floatingEndpoint = jpc.endpoints[1];
                    jpc.floatingIndex = 1;
                    jpc.target = dhParams.element;
                    jpc.targetId = dhParams.elementId;
                }

                // if this is an existing connection and detach is not allowed we won't continue. The connection's
                // endpoints have been reinstated; everything is back to how it was.
                if (existingConnection && jpc.suspendedEndpoint.id !== _ep.id) {
                    if (!jpc.isDetachAllowed(jpc) || !jpc.endpoints[idx].isDetachAllowed(jpc) || !jpc.suspendedEndpoint.isDetachAllowed(jpc) || !_jsPlumb.checkCondition("beforeDetach", jpc)) {
                        _doContinue = false;
                    }
                }

// ------------ wrap the execution path in a function so we can support asynchronous beforeDrop

                var continueFunction = function (optionalData) {
                    // remove this jpc from the current endpoint, which is a floating endpoint that we will
                    // subsequently discard.
                    jpc.endpoints[idx].detachFromConnection(jpc);

                    // if there's a suspended endpoint, detach it from the connection.
                    if (jpc.suspendedEndpoint) {
                        jpc.suspendedEndpoint.detachFromConnection(jpc);
                    }

                    jpc.endpoints[idx] = _ep;
                    _ep.addConnection(jpc);

                    // copy our parameters in to the connection:
                    var params = _ep.getParameters();
                    for (var aParam in params) {
                        jpc.setParameter(aParam, params[aParam]);
                    }

                    if (!existingConnection) {
                        // if not an existing connection and
                        if (params.draggable) {
                            _jsPlumb.initDraggable(this.element, dhParams.dragOptions, "internal", _jsPlumb);
                        }
                    }
                    else {
                        var suspendedElementId = jpc.suspendedEndpoint.elementId;
                        _jsPlumb.fireMoveEvent({
                            index: idx,
                            originalSourceId: idx === 0 ? suspendedElementId : jpc.sourceId,
                            newSourceId: idx === 0 ? _ep.elementId : jpc.sourceId,
                            originalTargetId: idx === 1 ? suspendedElementId : jpc.targetId,
                            newTargetId: idx === 1 ? _ep.elementId : jpc.targetId,
                            originalSourceEndpoint: idx === 0 ? jpc.suspendedEndpoint : jpc.endpoints[0],
                            newSourceEndpoint: idx === 0 ? _ep : jpc.endpoints[0],
                            originalTargetEndpoint: idx === 1 ? jpc.suspendedEndpoint : jpc.endpoints[1],
                            newTargetEndpoint: idx === 1 ? _ep : jpc.endpoints[1],
                            connection: jpc
                        }, originalEvent);
                    }

                    if (idx === 1) {
                        _jsPlumb.anchorManager.updateOtherEndpoint(jpc.sourceId, jpc.floatingId, jpc.targetId, jpc);
                    }
                    else {
                        _jsPlumb.anchorManager.sourceChanged(jpc.floatingId, jpc.sourceId, jpc, jpc.source);
                    }

                    // when makeSource has uniqueEndpoint:true, we want to create connections with new endpoints
                    // that are subsequently deleted. So makeSource sets `finalEndpoint`, which is the Endpoint to
                    // which the connection should be attached. The `detachFromConnection` call below results in the
                    // temporary endpoint being cleaned up.
                    if (jpc.endpoints[0].finalEndpoint) {
                        var _toDelete = jpc.endpoints[0];
                        _toDelete.detachFromConnection(jpc);
                        jpc.endpoints[0] = jpc.endpoints[0].finalEndpoint;
                        jpc.endpoints[0].addConnection(jpc);
                    }

                    // if optionalData was given, merge it onto the connection's data.
                    if (_ju.isObject(optionalData)) {
                        jpc.mergeData(optionalData);
                    }
                    // finalise will inform the anchor manager and also add to
                    // connectionsByScope if necessary.
                    _jsPlumb.finaliseConnection(jpc, null, originalEvent, false);
                    jpc.setHover(false);

                    // SP continuous anchor flush
                    _jsPlumb.revalidate(jpc.endpoints[0].element);

                }.bind(this);

                var dontContinueFunction = function () {
                    // otherwise just put it back on the endpoint it was on before the drag.
                    if (jpc.suspendedEndpoint) {
                        jpc.endpoints[idx] = jpc.suspendedEndpoint;
                        jpc.setHover(false);
                        jpc._forceDetach = true;
                        if (idx === 0) {
                            jpc.source = jpc.suspendedEndpoint.element;
                            jpc.sourceId = jpc.suspendedEndpoint.elementId;
                        } else {
                            jpc.target = jpc.suspendedEndpoint.element;
                            jpc.targetId = jpc.suspendedEndpoint.elementId;
                        }
                        jpc.suspendedEndpoint.addConnection(jpc);

                        // TODO checkSanity
                        if (idx === 1) {
                            _jsPlumb.anchorManager.updateOtherEndpoint(jpc.sourceId, jpc.floatingId, jpc.targetId, jpc);
                        }
                        else {
                            _jsPlumb.anchorManager.sourceChanged(jpc.floatingId, jpc.sourceId, jpc, jpc.source);
                        }

                        _jsPlumb.repaint(jpc.sourceId);
                        jpc._forceDetach = false;
                    }
                };

// --------------------------------------
                // now check beforeDrop.  this will be available only on Endpoints that are setup to
                // have a beforeDrop condition (although, secretly, under the hood all Endpoints and
                // the Connection have them, because they are on jsPlumbUIComponent.  shhh!), because
                // it only makes sense to have it on a target endpoint.
                _doContinue = _doContinue && dhParams.isDropAllowed(jpc.sourceId, jpc.targetId, jpc.scope, jpc, _ep);// && jpc.pending;

                if (_doContinue) {
                    continueFunction(_doContinue);
                    return true;
                }
                else {
                    dontContinueFunction();
                }
            }

            if (dhParams.maybeCleanup) {
                dhParams.maybeCleanup(_ep);
            }

            _jsPlumb.currentlyDragging = false;
        };
    };
}).call(typeof window !== 'undefined' ? window : this);

/*
 * This file contains the code for Connections.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;
(function () {

    "use strict";
    var root = this,
        _jp = root.jsPlumb,
        _ju = root.jsPlumbUtil;

    var makeConnector = function (_jsPlumb, renderMode, connectorName, connectorArgs, forComponent) {
            // first make sure we have a cache for the specified renderer
            _jp.Connectors[renderMode] = _jp.Connectors[renderMode] || {};

            // now see if the one we want exists; if not we will try to make it
            if (_jp.Connectors[renderMode][connectorName] == null) {

                if (_jp.Connectors[connectorName] == null) {
                    if (!_jsPlumb.Defaults.DoNotThrowErrors) {
                        throw new TypeError("jsPlumb: unknown connector type '" + connectorName + "'");
                    } else {
                        return null;
                    }
                }

                _jp.Connectors[renderMode][connectorName] = function() {
                    _jp.Connectors[connectorName].apply(this, arguments);
                    _jp.ConnectorRenderers[renderMode].apply(this, arguments);
                };

                _ju.extend(_jp.Connectors[renderMode][connectorName], [ _jp.Connectors[connectorName], _jp.ConnectorRenderers[renderMode]]);

            }

            return new _jp.Connectors[renderMode][connectorName](connectorArgs, forComponent);
        },
        _makeAnchor = function (anchorParams, elementId, _jsPlumb) {
            return (anchorParams) ? _jsPlumb.makeAnchor(anchorParams, elementId, _jsPlumb) : null;
        },
        _updateConnectedClass = function (conn, element, _jsPlumb, remove) {
            if (element != null) {
                element._jsPlumbConnections = element._jsPlumbConnections || {};
                if (remove) {
                    delete element._jsPlumbConnections[conn.id];
                }
                else {
                    element._jsPlumbConnections[conn.id] = true;
                }

                if (_ju.isEmpty(element._jsPlumbConnections)) {
                    _jsPlumb.removeClass(element, _jsPlumb.connectedClass);
                }
                else {
                    _jsPlumb.addClass(element, _jsPlumb.connectedClass);
                }
            }
        };

    _jp.Connection = function (params) {
        var _newEndpoint = params.newEndpoint;

        this.id = params.id;
        this.connector = null;
        this.idPrefix = "_jsplumb_c_";
        this.defaultLabelLocation = 0.5;
        this.defaultOverlayKeys = ["Overlays", "ConnectionOverlays"];
        // if a new connection is the result of moving some existing connection, params.previousConnection
        // will have that Connection in it. listeners for the jsPlumbConnection event can look for that
        // member and take action if they need to.
        this.previousConnection = params.previousConnection;
        this.source = _jp.getElement(params.source);
        this.target = _jp.getElement(params.target);


        _jp.OverlayCapableJsPlumbUIComponent.apply(this, arguments);

        // sourceEndpoint and targetEndpoint override source/target, if they are present. but 
        // source is not overridden if the Endpoint has declared it is not the final target of a connection;
        // instead we use the source that the Endpoint declares will be the final source element.
        if (params.sourceEndpoint) {
            this.source = params.sourceEndpoint.getElement();
            this.sourceId = params.sourceEndpoint.elementId;
        } else {
            this.sourceId = this._jsPlumb.instance.getId(this.source);
        }

        if (params.targetEndpoint) {
            this.target = params.targetEndpoint.getElement();
            this.targetId = params.targetEndpoint.elementId;
        } else {
            this.targetId = this._jsPlumb.instance.getId(this.target);
        }


        this.scope = params.scope; // scope may have been passed in to the connect call. if it wasn't, we will pull it from the source endpoint, after having initialised the endpoints.            
        this.endpoints = [];
        this.endpointStyles = [];

        var _jsPlumb = this._jsPlumb.instance;

        _jsPlumb.manage(this.sourceId, this.source);
        _jsPlumb.manage(this.targetId, this.target);

        this._jsPlumb.visible = true;

        this._jsPlumb.params = {
            cssClass: params.cssClass,
            container: params.container,
            "pointer-events": params["pointer-events"],
            editorParams: params.editorParams,
            overlays: params.overlays
        };
        this._jsPlumb.lastPaintedAt = null;

        // listen to mouseover and mouseout events passed from the container delegate.
        this.bind("mouseover", function () {
            this.setHover(true);
        }.bind(this));
        this.bind("mouseout", function () {
            this.setHover(false);
        }.bind(this));


// INITIALISATION CODE

        this.makeEndpoint = function (isSource, el, elId, ep) {
            elId = elId || this._jsPlumb.instance.getId(el);
            return this.prepareEndpoint(_jsPlumb, _newEndpoint, this, ep, isSource ? 0 : 1, params, el, elId);
        };

        // if type given, get the endpoint definitions mapping to that type from the jsplumb instance, and use those.
        // we apply types at the end of this constructor but endpoints are only honoured in a type definition at
        // create time.
        if (params.type) {
            params.endpoints = params.endpoints || this._jsPlumb.instance.deriveEndpointAndAnchorSpec(params.type).endpoints;
        }

        var eS = this.makeEndpoint(true, this.source, this.sourceId, params.sourceEndpoint),
            eT = this.makeEndpoint(false, this.target, this.targetId, params.targetEndpoint);

        if (eS) {
            _ju.addToList(params.endpointsByElement, this.sourceId, eS);
        }
        if (eT) {
            _ju.addToList(params.endpointsByElement, this.targetId, eT);
        }
        // if scope not set, set it to be the scope for the source endpoint.
        if (!this.scope) {
            this.scope = this.endpoints[0].scope;
        }

        // if explicitly told to (or not to) delete endpoints when empty, override endpoint's preferences
        if (params.deleteEndpointsOnEmpty != null) {
            this.endpoints[0].setDeleteOnEmpty(params.deleteEndpointsOnEmpty);
            this.endpoints[1].setDeleteOnEmpty(params.deleteEndpointsOnEmpty);
        }

// -------------------------- DEFAULT TYPE ---------------------------------------------

        // DETACHABLE
        var _detachable = _jsPlumb.Defaults.ConnectionsDetachable;
        if (params.detachable === false) {
            _detachable = false;
        }
        if (this.endpoints[0].connectionsDetachable === false) {
            _detachable = false;
        }
        if (this.endpoints[1].connectionsDetachable === false) {
            _detachable = false;
        }
        // REATTACH
        var _reattach = params.reattach || this.endpoints[0].reattachConnections || this.endpoints[1].reattachConnections || _jsPlumb.Defaults.ReattachConnections;

        this.appendToDefaultType({
            detachable: _detachable,
            reattach: _reattach,
            paintStyle:this.endpoints[0].connectorStyle || this.endpoints[1].connectorStyle || params.paintStyle || _jsPlumb.Defaults.PaintStyle || _jp.Defaults.PaintStyle,
            hoverPaintStyle:this.endpoints[0].connectorHoverStyle || this.endpoints[1].connectorHoverStyle || params.hoverPaintStyle || _jsPlumb.Defaults.HoverPaintStyle || _jp.Defaults.HoverPaintStyle
        });

        var _suspendedAt = _jsPlumb.getSuspendedAt();
        if (!_jsPlumb.isSuspendDrawing()) {
            // paint the endpoints
            var myInfo = _jsPlumb.getCachedData(this.sourceId),
                myOffset = myInfo.o, myWH = myInfo.s,
                otherInfo = _jsPlumb.getCachedData(this.targetId),
                otherOffset = otherInfo.o,
                otherWH = otherInfo.s,
                initialTimestamp = _suspendedAt || _jsPlumb.timestamp(),
                anchorLoc = this.endpoints[0].anchor.compute({
                    xy: [ myOffset.left, myOffset.top ], wh: myWH, element: this.endpoints[0],
                    elementId: this.endpoints[0].elementId,
                    txy: [ otherOffset.left, otherOffset.top ], twh: otherWH, tElement: this.endpoints[1],
                    timestamp: initialTimestamp
                });

            this.endpoints[0].paint({ anchorLoc: anchorLoc, timestamp: initialTimestamp });

            anchorLoc = this.endpoints[1].anchor.compute({
                xy: [ otherOffset.left, otherOffset.top ], wh: otherWH, element: this.endpoints[1],
                elementId: this.endpoints[1].elementId,
                txy: [ myOffset.left, myOffset.top ], twh: myWH, tElement: this.endpoints[0],
                timestamp: initialTimestamp
            });
            this.endpoints[1].paint({ anchorLoc: anchorLoc, timestamp: initialTimestamp });
        }

        this.getTypeDescriptor = function () {
            return "connection";
        };
        this.getAttachedElements = function () {
            return this.endpoints;
        };

        this.isDetachable = function (ep) {
            return this._jsPlumb.detachable === false ? false : ep != null ? ep.connectionsDetachable === true : this._jsPlumb.detachable === true;
        };
        this.setDetachable = function (detachable) {
            this._jsPlumb.detachable = detachable === true;
        };
        this.isReattach = function () {
            return this._jsPlumb.reattach === true || this.endpoints[0].reattachConnections === true || this.endpoints[1].reattachConnections === true;
        };
        this.setReattach = function (reattach) {
            this._jsPlumb.reattach = reattach === true;
        };

// END INITIALISATION CODE


// COST + DIRECTIONALITY
        // if cost not supplied, try to inherit from source endpoint
        this._jsPlumb.cost = params.cost || this.endpoints[0].getConnectionCost();
        this._jsPlumb.directed = params.directed;
        // inherit directed flag if set no source endpoint
        if (params.directed == null) {
            this._jsPlumb.directed = this.endpoints[0].areConnectionsDirected();
        }
// END COST + DIRECTIONALITY

// PARAMETERS
        // merge all the parameters objects into the connection.  parameters set
        // on the connection take precedence; then source endpoint params, then
        // finally target endpoint params.
        var _p = _jp.extend({}, this.endpoints[1].getParameters());
        _jp.extend(_p, this.endpoints[0].getParameters());
        _jp.extend(_p, this.getParameters());
        this.setParameters(_p);
// END PARAMETERS

// PAINTING

        this.setConnector(this.endpoints[0].connector || this.endpoints[1].connector || params.connector || _jsPlumb.Defaults.Connector || _jp.Defaults.Connector, true);
        var data = params.data == null || !_ju.isObject(params.data) ? {} : params.data;
        this.getData = function() { return data; };
        this.setData = function(d) { data = d || {}; };
        this.mergeData = function(d) { data = _jp.extend(data, d); };

        // the very last thing we do is apply types, if there are any.
        var _types = [ "default", this.endpoints[0].connectionType, this.endpoints[1].connectionType,  params.type ].join(" ");
        if (/[^\s]/.test(_types)) {
            this.addType(_types, params.data, true);
        }

        this.updateConnectedClass();

// END PAINTING    
    };

    _ju.extend(_jp.Connection, _jp.OverlayCapableJsPlumbUIComponent, {
        applyType: function (t, doNotRepaint, typeMap) {

            var _connector = null;
            if (t.connector != null) {
                _connector = this.getCachedTypeItem("connector", typeMap.connector);
                if (_connector == null) {
                    _connector = this.prepareConnector(t.connector, typeMap.connector);
                    this.cacheTypeItem("connector", _connector, typeMap.connector);
                }
                this.setPreparedConnector(_connector);
            }

            // none of these things result in the creation of objects so can be ignored.
            if (t.detachable != null) {
                this.setDetachable(t.detachable);
            }
            if (t.reattach != null) {
                this.setReattach(t.reattach);
            }
            if (t.scope) {
                this.scope = t.scope;
            }

            if (t.cssClass != null && this.canvas) {
                this._jsPlumb.instance.addClass(this.canvas, t.cssClass);
            }

            var _anchors = null;
            // this also results in the creation of objects.
            if (t.anchor) {
                // note that even if the param was anchor, we store `anchors`.
                _anchors = this.getCachedTypeItem("anchors", typeMap.anchor);
                if (_anchors == null) {
                    _anchors = [ this._jsPlumb.instance.makeAnchor(t.anchor), this._jsPlumb.instance.makeAnchor(t.anchor) ];
                    this.cacheTypeItem("anchors", _anchors, typeMap.anchor);
                }
            }
            else if (t.anchors) {
                _anchors = this.getCachedTypeItem("anchors", typeMap.anchors);
                if (_anchors == null) {
                    _anchors = [
                        this._jsPlumb.instance.makeAnchor(t.anchors[0]),
                        this._jsPlumb.instance.makeAnchor(t.anchors[1])
                    ];
                    this.cacheTypeItem("anchors", _anchors, typeMap.anchors);
                }
            }
            if (_anchors != null) {
                this.endpoints[0].anchor = _anchors[0];
                this.endpoints[1].anchor = _anchors[1];
                if (this.endpoints[1].anchor.isDynamic) {
                    this._jsPlumb.instance.repaint(this.endpoints[1].elementId);
                }
            }

            _jp.OverlayCapableJsPlumbUIComponent.applyType(this, t);
        },
        addClass: function (c, informEndpoints) {
            if (informEndpoints) {
                this.endpoints[0].addClass(c);
                this.endpoints[1].addClass(c);
                if (this.suspendedEndpoint) {
                    this.suspendedEndpoint.addClass(c);
                }
            }
            if (this.connector) {
                this.connector.addClass(c);
            }
        },
        removeClass: function (c, informEndpoints) {
            if (informEndpoints) {
                this.endpoints[0].removeClass(c);
                this.endpoints[1].removeClass(c);
                if (this.suspendedEndpoint) {
                    this.suspendedEndpoint.removeClass(c);
                }
            }
            if (this.connector) {
                this.connector.removeClass(c);
            }
        },
        isVisible: function () {
            return this._jsPlumb.visible;
        },
        setVisible: function (v) {
            this._jsPlumb.visible = v;
            if (this.connector) {
                this.connector.setVisible(v);
            }
            this.repaint();
        },
        cleanup: function () {
            this.updateConnectedClass(true);
            this.endpoints = null;
            this.source = null;
            this.target = null;
            if (this.connector != null) {
                this.connector.cleanup(true);
                this.connector.destroy(true);
            }
            this.connector = null;
        },
        updateConnectedClass:function(remove) {
            if (this._jsPlumb) {
                _updateConnectedClass(this, this.source, this._jsPlumb.instance, remove);
                _updateConnectedClass(this, this.target, this._jsPlumb.instance, remove);
            }
        },
        setHover: function (state) {
            if (this.connector && this._jsPlumb && !this._jsPlumb.instance.isConnectionBeingDragged()) {
                this.connector.setHover(state);
                root.jsPlumb[state ? "addClass" : "removeClass"](this.source, this._jsPlumb.instance.hoverSourceClass);
                root.jsPlumb[state ? "addClass" : "removeClass"](this.target, this._jsPlumb.instance.hoverTargetClass);
            }
        },
        getUuids:function() {
            return [ this.endpoints[0].getUuid(), this.endpoints[1].getUuid() ];
        },
        getCost: function () {
            return this._jsPlumb ? this._jsPlumb.cost : -Infinity;
        },
        setCost: function (c) {
            this._jsPlumb.cost = c;
        },
        isDirected: function () {
            return this._jsPlumb.directed;
        },
        getConnector: function () {
            return this.connector;
        },
        prepareConnector:function(connectorSpec, typeId) {
            var connectorArgs = {
                    _jsPlumb: this._jsPlumb.instance,
                    cssClass: this._jsPlumb.params.cssClass,
                    container: this._jsPlumb.params.container,
                    "pointer-events": this._jsPlumb.params["pointer-events"]
                },
                renderMode = this._jsPlumb.instance.getRenderMode(),
                connector;

            if (_ju.isString(connectorSpec)) {
                connector = makeConnector(this._jsPlumb.instance, renderMode, connectorSpec, connectorArgs, this);
            } // lets you use a string as shorthand.
            else if (_ju.isArray(connectorSpec)) {
                if (connectorSpec.length === 1) {
                    connector = makeConnector(this._jsPlumb.instance, renderMode, connectorSpec[0], connectorArgs, this);
                }
                else {
                    connector = makeConnector(this._jsPlumb.instance, renderMode, connectorSpec[0], _ju.merge(connectorSpec[1], connectorArgs), this);
                }
            }
            if (typeId != null) {
                connector.typeId = typeId;
            }
            return connector;
        },
        setPreparedConnector: function(connector, doNotRepaint, doNotChangeListenerComponent, typeId) {

            if (this.connector !== connector) {

                var previous, previousClasses = "";
                // the connector will not be cleaned up if it was set as part of a type, because `typeId` will be set on it
                // and we havent passed in `true` for "force" here.
                if (this.connector != null) {
                    previous = this.connector;
                    previousClasses = previous.getClass();
                    this.connector.cleanup();
                    this.connector.destroy();
                }

                this.connector = connector;
                if (typeId) {
                    this.cacheTypeItem("connector", connector, typeId);
                }

                this.canvas = this.connector.canvas;
                this.bgCanvas = this.connector.bgCanvas;

                // put classes from prior connector onto the canvas
                this.addClass(previousClasses);

                // new: instead of binding listeners per connector, we now just have one delegate on the container.
                // so for that handler we set the connection as the '_jsPlumb' member of the canvas element, and
                // bgCanvas, if it exists, which it does right now in the VML renderer, so it won't from v 2.0.0 onwards.
                if (this.canvas) {
                    this.canvas._jsPlumb = this;
                }
                if (this.bgCanvas) {
                    this.bgCanvas._jsPlumb = this;
                }

                if (previous != null) {
                    var o = this.getOverlays();
                    for (var i = 0; i < o.length; i++) {
                        if (o[i].transfer) {
                            o[i].transfer(this.connector);
                        }
                    }
                }

                if (!doNotChangeListenerComponent) {
                    this.setListenerComponent(this.connector);
                }
                if (!doNotRepaint) {
                    this.repaint();
                }
            }
        },
        setConnector: function (connectorSpec, doNotRepaint, doNotChangeListenerComponent, typeId) {
            var connector = this.prepareConnector(connectorSpec, typeId);
            this.setPreparedConnector(connector, doNotRepaint, doNotChangeListenerComponent, typeId);
        },
        paint: function (params) {

            if (!this._jsPlumb.instance.isSuspendDrawing() && this._jsPlumb.visible) {
                params = params || {};
                var timestamp = params.timestamp,
                // if the moving object is not the source we must transpose the two references.
                    swap = false,
                    tId = swap ? this.sourceId : this.targetId, sId = swap ? this.targetId : this.sourceId,
                    tIdx = swap ? 0 : 1, sIdx = swap ? 1 : 0;

                if (timestamp == null || timestamp !== this._jsPlumb.lastPaintedAt) {
                    var sourceInfo = this._jsPlumb.instance.updateOffset({elId:sId}).o,
                        targetInfo = this._jsPlumb.instance.updateOffset({elId:tId}).o,
                        sE = this.endpoints[sIdx], tE = this.endpoints[tIdx];

                    var sAnchorP = sE.anchor.getCurrentLocation({xy: [sourceInfo.left, sourceInfo.top], wh: [sourceInfo.width, sourceInfo.height], element: sE, timestamp: timestamp}),
                        tAnchorP = tE.anchor.getCurrentLocation({xy: [targetInfo.left, targetInfo.top], wh: [targetInfo.width, targetInfo.height], element: tE, timestamp: timestamp});

                    this.connector.resetBounds();

                    this.connector.compute({
                        sourcePos: sAnchorP,
                        targetPos: tAnchorP,
                        sourceOrientation:sE.anchor.getOrientation(sE),
                        targetOrientation:tE.anchor.getOrientation(tE),
                        sourceEndpoint: this.endpoints[sIdx],
                        targetEndpoint: this.endpoints[tIdx],
                        "stroke-width": this._jsPlumb.paintStyleInUse.strokeWidth,
                        sourceInfo: sourceInfo,
                        targetInfo: targetInfo
                    });

                    var overlayExtents = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

                    // compute overlays. we do this first so we can get their placements, and adjust the
                    // container if needs be (if an overlay would be clipped)
                    for (var i in this._jsPlumb.overlays) {
                        if (this._jsPlumb.overlays.hasOwnProperty(i)) {
                            var o = this._jsPlumb.overlays[i];
                            if (o.isVisible()) {
                                this._jsPlumb.overlayPlacements[i] = o.draw(this.connector, this._jsPlumb.paintStyleInUse, this.getAbsoluteOverlayPosition(o));
                                overlayExtents.minX = Math.min(overlayExtents.minX, this._jsPlumb.overlayPlacements[i].minX);
                                overlayExtents.maxX = Math.max(overlayExtents.maxX, this._jsPlumb.overlayPlacements[i].maxX);
                                overlayExtents.minY = Math.min(overlayExtents.minY, this._jsPlumb.overlayPlacements[i].minY);
                                overlayExtents.maxY = Math.max(overlayExtents.maxY, this._jsPlumb.overlayPlacements[i].maxY);
                            }
                        }
                    }

                    var lineWidth = parseFloat(this._jsPlumb.paintStyleInUse.strokeWidth || 1) / 2,
                        outlineWidth = parseFloat(this._jsPlumb.paintStyleInUse.strokeWidth || 0),
                        extents = {
                            xmin: Math.min(this.connector.bounds.minX - (lineWidth + outlineWidth), overlayExtents.minX),
                            ymin: Math.min(this.connector.bounds.minY - (lineWidth + outlineWidth), overlayExtents.minY),
                            xmax: Math.max(this.connector.bounds.maxX + (lineWidth + outlineWidth), overlayExtents.maxX),
                            ymax: Math.max(this.connector.bounds.maxY + (lineWidth + outlineWidth), overlayExtents.maxY)
                        };
                    // paint the connector.
                    this.connector.paint(this._jsPlumb.paintStyleInUse, null, extents);
                    // and then the overlays
                    for (var j in this._jsPlumb.overlays) {
                        if (this._jsPlumb.overlays.hasOwnProperty(j)) {
                            var p = this._jsPlumb.overlays[j];
                            if (p.isVisible()) {
                                p.paint(this._jsPlumb.overlayPlacements[j], extents);
                            }
                        }
                    }
                }
                this._jsPlumb.lastPaintedAt = timestamp;
            }
        },
        repaint: function (params) {
            var p = jsPlumb.extend(params || {}, {});
            p.elId = this.sourceId;
            this.paint(p);
        },
        prepareEndpoint: function (_jsPlumb, _newEndpoint, conn, existing, index, params, element, elementId) {
            var e;
            if (existing) {
                conn.endpoints[index] = existing;
                existing.addConnection(conn);
            } else {
                if (!params.endpoints) {
                    params.endpoints = [ null, null ];
                }
                var ep = params.endpoints[index] || params.endpoint || _jsPlumb.Defaults.Endpoints[index] || _jp.Defaults.Endpoints[index] || _jsPlumb.Defaults.Endpoint || _jp.Defaults.Endpoint;
                if (!params.endpointStyles) {
                    params.endpointStyles = [ null, null ];
                }
                if (!params.endpointHoverStyles) {
                    params.endpointHoverStyles = [ null, null ];
                }
                var es = params.endpointStyles[index] || params.endpointStyle || _jsPlumb.Defaults.EndpointStyles[index] || _jp.Defaults.EndpointStyles[index] || _jsPlumb.Defaults.EndpointStyle || _jp.Defaults.EndpointStyle;
                // Endpoints derive their fill from the connector's stroke, if no fill was specified.
                if (es.fill == null && params.paintStyle != null) {
                    es.fill = params.paintStyle.stroke;
                }

                if (es.outlineStroke == null && params.paintStyle != null) {
                    es.outlineStroke = params.paintStyle.outlineStroke;
                }
                if (es.outlineWidth == null && params.paintStyle != null) {
                    es.outlineWidth = params.paintStyle.outlineWidth;
                }

                var ehs = params.endpointHoverStyles[index] || params.endpointHoverStyle || _jsPlumb.Defaults.EndpointHoverStyles[index] || _jp.Defaults.EndpointHoverStyles[index] || _jsPlumb.Defaults.EndpointHoverStyle || _jp.Defaults.EndpointHoverStyle;
                // endpoint hover fill style is derived from connector's hover stroke style
                if (params.hoverPaintStyle != null) {
                    if (ehs == null) {
                        ehs = {};
                    }
                    if (ehs.fill == null) {
                        ehs.fill = params.hoverPaintStyle.stroke;
                    }
                }
                var a = params.anchors ? params.anchors[index] :
                        params.anchor ? params.anchor :
                            _makeAnchor(_jsPlumb.Defaults.Anchors[index], elementId, _jsPlumb) ||
                            _makeAnchor(_jp.Defaults.Anchors[index], elementId, _jsPlumb) ||
                            _makeAnchor(_jsPlumb.Defaults.Anchor, elementId, _jsPlumb) ||
                            _makeAnchor(_jp.Defaults.Anchor, elementId, _jsPlumb),
                    u = params.uuids ? params.uuids[index] : null;

                e = _newEndpoint({
                    paintStyle: es, hoverPaintStyle: ehs, endpoint: ep, connections: [ conn ],
                    uuid: u, anchor: a, source: element, scope: params.scope,
                    reattach: params.reattach || _jsPlumb.Defaults.ReattachConnections,
                    detachable: params.detachable || _jsPlumb.Defaults.ConnectionsDetachable
                });
                if (existing == null) {
                    e.setDeleteOnEmpty(true);
                }
                conn.endpoints[index] = e;

                if (params.drawEndpoints === false) {
                    e.setVisible(false, true, true);
                }

            }
            return e;
        }

    }); // END Connection class            
}).call(typeof window !== 'undefined' ? window : this);

/*
 * This file contains the code for creating and manipulating anchors.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;
(function () {

    "use strict";

    var root = this,
        _ju = root.jsPlumbUtil,
        _jp = root.jsPlumb;

    //
    // manages anchors for all elements.
    //
    _jp.AnchorManager = function (params) {
        var _amEndpoints = {},
            continuousAnchorLocations = {},
            continuousAnchorOrientations = {},
            connectionsByElementId = {},
            self = this,
            anchorLists = {},
            jsPlumbInstance = params.jsPlumbInstance,
            floatingConnections = {},
            // used by placeAnchors function
            placeAnchorsOnLine = function (desc, elementDimensions, elementPosition, connections, horizontal, otherMultiplier, reverse) {
                var a = [], step = elementDimensions[horizontal ? 0 : 1] / (connections.length + 1);

                for (var i = 0; i < connections.length; i++) {
                    var val = (i + 1) * step, other = otherMultiplier * elementDimensions[horizontal ? 1 : 0];
                    if (reverse) {
                        val = elementDimensions[horizontal ? 0 : 1] - val;
                    }

                    var dx = (horizontal ? val : other), x = elementPosition[0] + dx, xp = dx / elementDimensions[0],
                        dy = (horizontal ? other : val), y = elementPosition[1] + dy, yp = dy / elementDimensions[1];

                    a.push([ x, y, xp, yp, connections[i][1], connections[i][2] ]);
                }

                return a;
            },
            // used by edgeSortFunctions
            currySort = function (reverseAngles) {
                return function (a, b) {
                    var r = true;
                    if (reverseAngles) {
                        r = a[0][0] < b[0][0];
                    }
                    else {
                        r = a[0][0] > b[0][0];
                    }
                    return r === false ? -1 : 1;
                };
            },
            // used by edgeSortFunctions
            leftSort = function (a, b) {
                // first get adjusted values
                var p1 = a[0][0] < 0 ? -Math.PI - a[0][0] : Math.PI - a[0][0],
                    p2 = b[0][0] < 0 ? -Math.PI - b[0][0] : Math.PI - b[0][0];
                if (p1 > p2) {
                    return 1;
                }
                else {
                    return -1;
                }
            },
            // used by placeAnchors
            edgeSortFunctions = {
                "top": function (a, b) {
                    return a[0] > b[0] ? 1 : -1;
                },
                "right": currySort(true),
                "bottom": currySort(true),
                "left": leftSort
            },
            // used by placeAnchors
            _sortHelper = function (_array, _fn) {
                return _array.sort(_fn);
            },
            // used by AnchorManager.redraw
            placeAnchors = function (elementId, _anchorLists) {
                var cd = jsPlumbInstance.getCachedData(elementId), sS = cd.s, sO = cd.o,
                    placeSomeAnchors = function (desc, elementDimensions, elementPosition, unsortedConnections, isHorizontal, otherMultiplier, orientation) {
                        if (unsortedConnections.length > 0) {
                            var sc = _sortHelper(unsortedConnections, edgeSortFunctions[desc]), // puts them in order based on the target element's pos on screen
                                reverse = desc === "right" || desc === "top",
                                anchors = placeAnchorsOnLine(desc, elementDimensions,
                                    elementPosition, sc,
                                    isHorizontal, otherMultiplier, reverse);

                            // takes a computed anchor position and adjusts it for parent offset and scroll, then stores it.
                            var _setAnchorLocation = function (endpoint, anchorPos) {
                                continuousAnchorLocations[endpoint.id] = [ anchorPos[0], anchorPos[1], anchorPos[2], anchorPos[3] ];
                                continuousAnchorOrientations[endpoint.id] = orientation;
                            };

                            for (var i = 0; i < anchors.length; i++) {
                                var c = anchors[i][4], weAreSource = c.endpoints[0].elementId === elementId, weAreTarget = c.endpoints[1].elementId === elementId;
                                if (weAreSource) {
                                    _setAnchorLocation(c.endpoints[0], anchors[i]);
                                }
                                if (weAreTarget) {
                                    _setAnchorLocation(c.endpoints[1], anchors[i]);
                                }
                            }
                        }
                    };

                placeSomeAnchors("bottom", sS, [sO.left, sO.top], _anchorLists.bottom, true, 1, [0, 1]);
                placeSomeAnchors("top", sS, [sO.left, sO.top], _anchorLists.top, true, 0, [0, -1]);
                placeSomeAnchors("left", sS, [sO.left, sO.top], _anchorLists.left, false, 0, [-1, 0]);
                placeSomeAnchors("right", sS, [sO.left, sO.top], _anchorLists.right, false, 1, [1, 0]);
            };

        this.reset = function () {
            _amEndpoints = {};
            connectionsByElementId = {};
            anchorLists = {};
        };
        this.addFloatingConnection = function (key, conn) {
            floatingConnections[key] = conn;
        };
        this.removeFloatingConnection = function (key) {
            delete floatingConnections[key];
        };
        this.newConnection = function (conn) {
            var sourceId = conn.sourceId, targetId = conn.targetId,
                ep = conn.endpoints,
                doRegisterTarget = true,
                registerConnection = function (otherIndex, otherEndpoint, otherAnchor, elId, c) {
                    if ((sourceId === targetId) && otherAnchor.isContinuous) {
                        // remove the target endpoint's canvas.  we dont need it.
                        conn._jsPlumb.instance.removeElement(ep[1].canvas);
                        doRegisterTarget = false;
                    }
                    _ju.addToList(connectionsByElementId, elId, [c, otherEndpoint, otherAnchor.constructor === _jp.DynamicAnchor]);
                };

            registerConnection(0, ep[0], ep[0].anchor, targetId, conn);
            if (doRegisterTarget) {
                registerConnection(1, ep[1], ep[1].anchor, sourceId, conn);
            }
        };
        var removeEndpointFromAnchorLists = function (endpoint) {
            (function (list, eId) {
                if (list) {  // transient anchors dont get entries in this list.
                    var f = function (e) {
                        return e[4] === eId;
                    };
                    _ju.removeWithFunction(list.top, f);
                    _ju.removeWithFunction(list.left, f);
                    _ju.removeWithFunction(list.bottom, f);
                    _ju.removeWithFunction(list.right, f);
                }
            })(anchorLists[endpoint.elementId], endpoint.id);
        };
        this.connectionDetached = function (connInfo, doNotRedraw) {
            var connection = connInfo.connection || connInfo,
                sourceId = connInfo.sourceId,
                targetId = connInfo.targetId,
                ep = connection.endpoints,
                removeConnection = function (otherIndex, otherEndpoint, otherAnchor, elId, c) {
                    _ju.removeWithFunction(connectionsByElementId[elId], function (_c) {
                        return _c[0].id === c.id;
                    });
                };

            removeConnection(1, ep[1], ep[1].anchor, sourceId, connection);
            removeConnection(0, ep[0], ep[0].anchor, targetId, connection);
            if (connection.floatingId) {
                removeConnection(connection.floatingIndex, connection.floatingEndpoint, connection.floatingEndpoint.anchor, connection.floatingId, connection);
                removeEndpointFromAnchorLists(connection.floatingEndpoint);
            }

            // remove from anchorLists
            removeEndpointFromAnchorLists(connection.endpoints[0]);
            removeEndpointFromAnchorLists(connection.endpoints[1]);

            if (!doNotRedraw) {
                self.redraw(connection.sourceId);
                if (connection.targetId !== connection.sourceId) {
                    self.redraw(connection.targetId);
                }
            }
        };
        this.add = function (endpoint, elementId) {
            _ju.addToList(_amEndpoints, elementId, endpoint);
        };
        this.changeId = function (oldId, newId) {
            connectionsByElementId[newId] = connectionsByElementId[oldId];
            _amEndpoints[newId] = _amEndpoints[oldId];
            delete connectionsByElementId[oldId];
            delete _amEndpoints[oldId];
        };
        this.getConnectionsFor = function (elementId) {
            return connectionsByElementId[elementId] || [];
        };
        this.getEndpointsFor = function (elementId) {
            return _amEndpoints[elementId] || [];
        };
        this.deleteEndpoint = function (endpoint) {
            _ju.removeWithFunction(_amEndpoints[endpoint.elementId], function (e) {
                return e.id === endpoint.id;
            });
            removeEndpointFromAnchorLists(endpoint);
        };
        this.clearFor = function (elementId) {
            delete _amEndpoints[elementId];
            _amEndpoints[elementId] = [];
        };
        // updates the given anchor list by either updating an existing anchor's info, or adding it. this function
        // also removes the anchor from its previous list, if the edge it is on has changed.
        // all connections found along the way (those that are connected to one of the faces this function
        // operates on) are added to the connsToPaint list, as are their endpoints. in this way we know to repaint
        // them wthout having to calculate anything else about them.
        var _updateAnchorList = function (lists, theta, order, conn, aBoolean, otherElId, idx, reverse, edgeId, elId, connsToPaint, endpointsToPaint) {
            // first try to find the exact match, but keep track of the first index of a matching element id along the way.s
            var exactIdx = -1,
                firstMatchingElIdx = -1,
                endpoint = conn.endpoints[idx],
                endpointId = endpoint.id,
                oIdx = [1, 0][idx],
                values = [
                    [ theta, order ],
                    conn,
                    aBoolean,
                    otherElId,
                    endpointId
                ],
                listToAddTo = lists[edgeId],
                listToRemoveFrom = endpoint._continuousAnchorEdge ? lists[endpoint._continuousAnchorEdge] : null,
                i,
                candidate;

            if (listToRemoveFrom) {
                var rIdx = _ju.findWithFunction(listToRemoveFrom, function (e) {
                    return e[4] === endpointId;
                });
                if (rIdx !== -1) {
                    listToRemoveFrom.splice(rIdx, 1);
                    // get all connections from this list
                    for (i = 0; i < listToRemoveFrom.length; i++) {
                        candidate = listToRemoveFrom[i][1];
                        _ju.addWithFunction(connsToPaint, candidate, function (c) {
                            return c.id === candidate.id;
                        });
                        _ju.addWithFunction(endpointsToPaint, listToRemoveFrom[i][1].endpoints[idx], function (e) {
                            return e.id === candidate.endpoints[idx].id;
                        });
                        _ju.addWithFunction(endpointsToPaint, listToRemoveFrom[i][1].endpoints[oIdx], function (e) {
                            return e.id === candidate.endpoints[oIdx].id;
                        });
                    }
                }
            }

            for (i = 0; i < listToAddTo.length; i++) {
                candidate = listToAddTo[i][1];
                if (params.idx === 1 && listToAddTo[i][3] === otherElId && firstMatchingElIdx === -1) {
                    firstMatchingElIdx = i;
                }
                _ju.addWithFunction(connsToPaint, candidate, function (c) {
                    return c.id === candidate.id;
                });
                _ju.addWithFunction(endpointsToPaint, listToAddTo[i][1].endpoints[idx], function (e) {
                    return e.id === candidate.endpoints[idx].id;
                });
                _ju.addWithFunction(endpointsToPaint, listToAddTo[i][1].endpoints[oIdx], function (e) {
                    return e.id === candidate.endpoints[oIdx].id;
                });
            }
            if (exactIdx !== -1) {
                listToAddTo[exactIdx] = values;
            }
            else {
                var insertIdx = reverse ? firstMatchingElIdx !== -1 ? firstMatchingElIdx : 0 : listToAddTo.length; // of course we will get this from having looked through the array shortly.
                listToAddTo.splice(insertIdx, 0, values);
            }

            // store this for next time.
            endpoint._continuousAnchorEdge = edgeId;
        };

        //
        // find the entry in an endpoint's list for this connection and update its target endpoint
        // with the current target in the connection.
        // This method and sourceChanged need to be folder into one.
        //
        this.updateOtherEndpoint = function (sourceElId, oldTargetId, newTargetId, connection) {
            var sIndex = _ju.findWithFunction(connectionsByElementId[sourceElId], function (i) {
                    return i[0].id === connection.id;
                }),
                tIndex = _ju.findWithFunction(connectionsByElementId[oldTargetId], function (i) {
                    return i[0].id === connection.id;
                });

            // update or add data for source
            if (sIndex !== -1) {
                connectionsByElementId[sourceElId][sIndex][0] = connection;
                connectionsByElementId[sourceElId][sIndex][1] = connection.endpoints[1];
                connectionsByElementId[sourceElId][sIndex][2] = connection.endpoints[1].anchor.constructor === _jp.DynamicAnchor;
            }

            // remove entry for previous target (if there)
            if (tIndex > -1) {
                connectionsByElementId[oldTargetId].splice(tIndex, 1);
                // add entry for new target
                _ju.addToList(connectionsByElementId, newTargetId, [connection, connection.endpoints[0], connection.endpoints[0].anchor.constructor === _jp.DynamicAnchor]);
            }

            connection.updateConnectedClass();
        };

        //
        // notification that the connection given has changed source from the originalId to the newId.
        // This involves:
        // 1. removing the connection from the list of connections stored for the originalId
        // 2. updating the source information for the target of the connection
        // 3. re-registering the connection in connectionsByElementId with the newId
        //
        this.sourceChanged = function (originalId, newId, connection, newElement) {
            if (originalId !== newId) {

                connection.sourceId = newId;
                connection.source = newElement;

                // remove the entry that points from the old source to the target
                _ju.removeWithFunction(connectionsByElementId[originalId], function (info) {
                    return info[0].id === connection.id;
                });
                // find entry for target and update it
                var tIdx = _ju.findWithFunction(connectionsByElementId[connection.targetId], function (i) {
                    return i[0].id === connection.id;
                });
                if (tIdx > -1) {
                    connectionsByElementId[connection.targetId][tIdx][0] = connection;
                    connectionsByElementId[connection.targetId][tIdx][1] = connection.endpoints[0];
                    connectionsByElementId[connection.targetId][tIdx][2] = connection.endpoints[0].anchor.constructor === _jp.DynamicAnchor;
                }
                // add entry for new source
                _ju.addToList(connectionsByElementId, newId, [connection, connection.endpoints[1], connection.endpoints[1].anchor.constructor === _jp.DynamicAnchor]);

                // TODO SP not final on this yet. when a user drags an existing connection and it turns into a self
                // loop, then this code hides the target endpoint (by removing it from the DOM) But I think this should
                // occur only if the anchor is Continuous
                if (connection.endpoints[1].anchor.isContinuous) {
                    if (connection.source === connection.target) {
                        connection._jsPlumb.instance.removeElement(connection.endpoints[1].canvas);
                    }
                    else {
                        if (connection.endpoints[1].canvas.parentNode == null) {
                            connection._jsPlumb.instance.appendElement(connection.endpoints[1].canvas);
                        }
                    }
                }

                connection.updateConnectedClass();
            }
        };

        //
        // moves the given endpoint from `currentId` to `element`.
        // This involves:
        //
        // 1. changing the key in _amEndpoints under which the endpoint is stored
        // 2. changing the source or target values in all of the endpoint's connections
        // 3. changing the array in connectionsByElementId in which the endpoint's connections
        //    are stored (done by either sourceChanged or updateOtherEndpoint)
        //
        this.rehomeEndpoint = function (ep, currentId, element) {
            var eps = _amEndpoints[currentId] || [],
                elementId = jsPlumbInstance.getId(element);

            if (elementId !== currentId) {
                var idx = eps.indexOf(ep);
                if (idx > -1) {
                    var _ep = eps.splice(idx, 1)[0];
                    self.add(_ep, elementId);
                }
            }

            for (var i = 0; i < ep.connections.length; i++) {
                if (ep.connections[i].sourceId === currentId) {
                    self.sourceChanged(currentId, ep.elementId, ep.connections[i], ep.element);
                }
                else if (ep.connections[i].targetId === currentId) {
                    ep.connections[i].targetId = ep.elementId;
                    ep.connections[i].target = ep.element;
                    self.updateOtherEndpoint(ep.connections[i].sourceId, currentId, ep.elementId, ep.connections[i]);
                }
            }
        };

        this.redraw = function (elementId, ui, timestamp, offsetToUI, clearEdits, doNotRecalcEndpoint) {

            if (!jsPlumbInstance.isSuspendDrawing()) {
                // get all the endpoints for this element
                var ep = _amEndpoints[elementId] || [],
                    endpointConnections = connectionsByElementId[elementId] || [],
                    connectionsToPaint = [],
                    endpointsToPaint = [],
                    anchorsToUpdate = [];

                timestamp = timestamp || jsPlumbInstance.timestamp();
                // offsetToUI are values that would have been calculated in the dragManager when registering
                // an endpoint for an element that had a parent (somewhere in the hierarchy) that had been
                // registered as draggable.
                offsetToUI = offsetToUI || {left: 0, top: 0};
                if (ui) {
                    ui = {
                        left: ui.left + offsetToUI.left,
                        top: ui.top + offsetToUI.top
                    };
                }

                // valid for one paint cycle.
                var myOffset = jsPlumbInstance.updateOffset({ elId: elementId, offset: ui, recalc: false, timestamp: timestamp }),
                    orientationCache = {};

                // actually, first we should compute the orientation of this element to all other elements to which
                // this element is connected with a continuous anchor (whether both ends of the connection have
                // a continuous anchor or just one)

                for (var i = 0; i < endpointConnections.length; i++) {
                    var conn = endpointConnections[i][0],
                        sourceId = conn.sourceId,
                        targetId = conn.targetId,
                        sourceContinuous = conn.endpoints[0].anchor.isContinuous,
                        targetContinuous = conn.endpoints[1].anchor.isContinuous;

                    if (sourceContinuous || targetContinuous) {
                        var oKey = sourceId + "_" + targetId,
                            o = orientationCache[oKey],
                            oIdx = conn.sourceId === elementId ? 1 : 0;

                        if (sourceContinuous && !anchorLists[sourceId]) {
                            anchorLists[sourceId] = { top: [], right: [], bottom: [], left: [] };
                        }
                        if (targetContinuous && !anchorLists[targetId]) {
                            anchorLists[targetId] = { top: [], right: [], bottom: [], left: [] };
                        }

                        if (elementId !== targetId) {
                            jsPlumbInstance.updateOffset({ elId: targetId, timestamp: timestamp });
                        }
                        if (elementId !== sourceId) {
                            jsPlumbInstance.updateOffset({ elId: sourceId, timestamp: timestamp });
                        }

                        var td = jsPlumbInstance.getCachedData(targetId),
                            sd = jsPlumbInstance.getCachedData(sourceId);

                        if (targetId === sourceId && (sourceContinuous || targetContinuous)) {
                            // here we may want to improve this by somehow determining the face we'd like
                            // to put the connector on.  ideally, when drawing, the face should be calculated
                            // by determining which face is closest to the point at which the mouse button
                            // was released.  for now, we're putting it on the top face.
                            _updateAnchorList( anchorLists[sourceId], -Math.PI / 2, 0, conn, false, targetId, 0, false, "top", sourceId, connectionsToPaint, endpointsToPaint);
                            _updateAnchorList( anchorLists[targetId], -Math.PI / 2, 0, conn, false, sourceId, 1, false, "top", targetId, connectionsToPaint, endpointsToPaint);
                        }
                        else {
                            if (!o) {
                                o = this.calculateOrientation(sourceId, targetId, sd.o, td.o, conn.endpoints[0].anchor, conn.endpoints[1].anchor, conn);
                                orientationCache[oKey] = o;
                                // this would be a performance enhancement, but the computed angles need to be clamped to
                                //the (-PI/2 -> PI/2) range in order for the sorting to work properly.
                                /*  orientationCache[oKey2] = {
                                 orientation:o.orientation,
                                 a:[o.a[1], o.a[0]],
                                 theta:o.theta + Math.PI,
                                 theta2:o.theta2 + Math.PI
                                 };*/
                            }
                            if (sourceContinuous) {
                                _updateAnchorList(anchorLists[sourceId], o.theta, 0, conn, false, targetId, 0, false, o.a[0], sourceId, connectionsToPaint, endpointsToPaint);
                            }
                            if (targetContinuous) {
                                _updateAnchorList(anchorLists[targetId], o.theta2, -1, conn, true, sourceId, 1, true, o.a[1], targetId, connectionsToPaint, endpointsToPaint);
                            }
                        }

                        if (sourceContinuous) {
                            _ju.addWithFunction(anchorsToUpdate, sourceId, function (a) {
                                return a === sourceId;
                            });
                        }
                        if (targetContinuous) {
                            _ju.addWithFunction(anchorsToUpdate, targetId, function (a) {
                                return a === targetId;
                            });
                        }
                        _ju.addWithFunction(connectionsToPaint, conn, function (c) {
                            return c.id === conn.id;
                        });
                        if ((sourceContinuous && oIdx === 0) || (targetContinuous && oIdx === 1)) {
                            _ju.addWithFunction(endpointsToPaint, conn.endpoints[oIdx], function (e) {
                                return e.id === conn.endpoints[oIdx].id;
                            });
                        }
                    }
                }

                // place Endpoints whose anchors are continuous but have no Connections
                for (i = 0; i < ep.length; i++) {
                    if (ep[i].connections.length === 0 && ep[i].anchor.isContinuous) {
                        if (!anchorLists[elementId]) {
                            anchorLists[elementId] = { top: [], right: [], bottom: [], left: [] };
                        }
                        _updateAnchorList(anchorLists[elementId], -Math.PI / 2, 0, {endpoints: [ep[i], ep[i]], paint: function () {
                        }}, false, elementId, 0, false, ep[i].anchor.getDefaultFace(), elementId, connectionsToPaint, endpointsToPaint);
                        _ju.addWithFunction(anchorsToUpdate, elementId, function (a) {
                            return a === elementId;
                        });
                    }
                }

                // now place all the continuous anchors we need to;
                for (i = 0; i < anchorsToUpdate.length; i++) {
                    placeAnchors(anchorsToUpdate[i], anchorLists[anchorsToUpdate[i]]);
                }

                // now that continuous anchors have been placed, paint all the endpoints for this element
                for (i = 0; i < ep.length; i++) {
                    ep[i].paint({ timestamp: timestamp, offset: myOffset, dimensions: myOffset.s, recalc: doNotRecalcEndpoint !== true });
                }

                // ... and any other endpoints we came across as a result of the continuous anchors.
                for (i = 0; i < endpointsToPaint.length; i++) {
                    var cd = jsPlumbInstance.getCachedData(endpointsToPaint[i].elementId);
                    //endpointsToPaint[i].paint({ timestamp: timestamp, offset: cd, dimensions: cd.s });
                    endpointsToPaint[i].paint({ timestamp: null, offset: cd, dimensions: cd.s });
                }

                // paint all the standard and "dynamic connections", which are connections whose other anchor is
                // static and therefore does need to be recomputed; we make sure that happens only one time.

                // TODO we could have compiled a list of these in the first pass through connections; might save some time.
                for (i = 0; i < endpointConnections.length; i++) {
                    var otherEndpoint = endpointConnections[i][1];
                    if (otherEndpoint.anchor.constructor === _jp.DynamicAnchor) {
                        otherEndpoint.paint({ elementWithPrecedence: elementId, timestamp: timestamp });
                        _ju.addWithFunction(connectionsToPaint, endpointConnections[i][0], function (c) {
                            return c.id === endpointConnections[i][0].id;
                        });
                        // all the connections for the other endpoint now need to be repainted
                        for (var k = 0; k < otherEndpoint.connections.length; k++) {
                            if (otherEndpoint.connections[k] !== endpointConnections[i][0]) {
                                _ju.addWithFunction(connectionsToPaint, otherEndpoint.connections[k], function (c) {
                                    return c.id === otherEndpoint.connections[k].id;
                                });
                            }
                        }
                    } else {
                        _ju.addWithFunction(connectionsToPaint, endpointConnections[i][0], function (c) {
                            return c.id === endpointConnections[i][0].id;
                        });
                    }
                }

                // paint current floating connection for this element, if there is one.
                var fc = floatingConnections[elementId];
                if (fc) {
                    fc.paint({timestamp: timestamp, recalc: false, elId: elementId});
                }

                // paint all the connections
                for (i = 0; i < connectionsToPaint.length; i++) {
                    connectionsToPaint[i].paint({elId: elementId, timestamp: null, recalc: false, clearEdits: clearEdits});
                }
            }
        };

        var ContinuousAnchor = function (anchorParams) {
            _ju.EventGenerator.apply(this);
            this.type = "Continuous";
            this.isDynamic = true;
            this.isContinuous = true;
            var faces = anchorParams.faces || ["top", "right", "bottom", "left"],
                clockwise = !(anchorParams.clockwise === false),
                availableFaces = { },
                opposites = { "top": "bottom", "right": "left", "left": "right", "bottom": "top" },
                clockwiseOptions = { "top": "right", "right": "bottom", "left": "top", "bottom": "left" },
                antiClockwiseOptions = { "top": "left", "right": "top", "left": "bottom", "bottom": "right" },
                secondBest = clockwise ? clockwiseOptions : antiClockwiseOptions,
                lastChoice = clockwise ? antiClockwiseOptions : clockwiseOptions,
                cssClass = anchorParams.cssClass || "",
                _currentFace = null, _lockedFace = null, X_AXIS_FACES = ["left", "right"], Y_AXIS_FACES = ["top", "bottom"],
                _lockedAxis = null;

            for (var i = 0; i < faces.length; i++) {
                availableFaces[faces[i]] = true;
            }

            this.getDefaultFace = function () {
                return faces.length === 0 ? "top" : faces[0];
            };

            this.isRelocatable = function() { return true; };
            this.isSnapOnRelocate = function() { return true; };

            // if the given edge is supported, returns it. otherwise looks for a substitute that _is_
            // supported. if none supported we also return the request edge.
            this.verifyEdge = function (edge) {
                if (availableFaces[edge]) {
                    return edge;
                }
                else if (availableFaces[opposites[edge]]) {
                    return opposites[edge];
                }
                else if (availableFaces[secondBest[edge]]) {
                    return secondBest[edge];
                }
                else if (availableFaces[lastChoice[edge]]) {
                    return lastChoice[edge];
                }
                return edge; // we have to give them something.
            };

            this.isEdgeSupported = function (edge) {
                return  _lockedAxis == null ?

                    (_lockedFace == null ? availableFaces[edge] === true : _lockedFace === edge)

                    : _lockedAxis.indexOf(edge) !== -1;
            };

            this.setCurrentFace = function(face, overrideLock) {
                _currentFace = face;
                // if currently locked, and the user wants to override, do that.
                if (overrideLock && _lockedFace != null) {
                    _lockedFace = _currentFace;
                }
            };

            this.getCurrentFace = function() { return _currentFace; };
            this.getSupportedFaces = function() {
                var af = [];
                for (var k in availableFaces) {
                    if (availableFaces[k]) {
                        af.push(k);
                    }
                }
                return af;
            };

            this.lock = function() {
                _lockedFace = _currentFace;
            };
            this.unlock = function() {
                _lockedFace = null;
            };
            this.isLocked = function() {
                return _lockedFace != null;
            };

            this.lockCurrentAxis = function() {
                if (_currentFace != null) {
                    _lockedAxis = (_currentFace === "left" || _currentFace === "right") ? X_AXIS_FACES : Y_AXIS_FACES;
                }
            };

            this.unlockCurrentAxis = function() {
                _lockedAxis = null;
            };

            this.compute = function (params) {
                return continuousAnchorLocations[params.element.id] || [0, 0];
            };
            this.getCurrentLocation = function (params) {
                return continuousAnchorLocations[params.element.id] || [0, 0];
            };
            this.getOrientation = function (endpoint) {
                return continuousAnchorOrientations[endpoint.id] || [0, 0];
            };
            this.getCssClass = function () {
                return cssClass;
            };
        };

        // continuous anchors
        jsPlumbInstance.continuousAnchorFactory = {
            get: function (params) {
                return new ContinuousAnchor(params);
            },
            clear: function (elementId) {
                delete continuousAnchorLocations[elementId];
            }
        };
    };

    _jp.AnchorManager.prototype.calculateOrientation = function (sourceId, targetId, sd, td, sourceAnchor, targetAnchor) {

        var Orientation = { HORIZONTAL: "horizontal", VERTICAL: "vertical", DIAGONAL: "diagonal", IDENTITY: "identity" },
            axes = ["left", "top", "right", "bottom"];

        if (sourceId === targetId) {
            return {
                orientation: Orientation.IDENTITY,
                a: ["top", "top"]
            };
        }

        var theta = Math.atan2((td.centery - sd.centery), (td.centerx - sd.centerx)),
            theta2 = Math.atan2((sd.centery - td.centery), (sd.centerx - td.centerx));

// --------------------------------------------------------------------------------------

        // improved face calculation. get midpoints of each face for source and target, then put in an array with all combinations of
        // source/target faces. sort this array by distance between midpoints. the entry at index 0 is our preferred option. we can
        // go through the array one by one until we find an entry in which each requested face is supported.
        var candidates = [], midpoints = { };
        (function (types, dim) {
            for (var i = 0; i < types.length; i++) {
                midpoints[types[i]] = {
                    "left": [ dim[i].left, dim[i].centery ],
                    "right": [ dim[i].right, dim[i].centery ],
                    "top": [ dim[i].centerx, dim[i].top ],
                    "bottom": [ dim[i].centerx , dim[i].bottom]
                };
            }
        })([ "source", "target" ], [ sd, td ]);

        for (var sf = 0; sf < axes.length; sf++) {
            for (var tf = 0; tf < axes.length; tf++) {
                candidates.push({
                    source: axes[sf],
                    target: axes[tf],
                    dist: Biltong.lineLength(midpoints.source[axes[sf]], midpoints.target[axes[tf]])
                });
            }
        }

        candidates.sort(function (a, b) {
            return a.dist < b.dist ? -1 : a.dist > b.dist ? 1 : 0;
        });

        // now go through this list and try to get an entry that satisfies both (there will be one, unless one of the anchors
        // declares no available faces)
        var sourceEdge = candidates[0].source, targetEdge = candidates[0].target;
        for (var i = 0; i < candidates.length; i++) {

            if (!sourceAnchor.isContinuous || sourceAnchor.isEdgeSupported(candidates[i].source)) {
                sourceEdge = candidates[i].source;
            }
            else {
                sourceEdge = null;
            }

            if (!targetAnchor.isContinuous || targetAnchor.isEdgeSupported(candidates[i].target)) {
                targetEdge = candidates[i].target;
            }
            else {
                targetEdge = null;
            }

            if (sourceEdge != null && targetEdge != null) {
                break;
            }
        }

        if (sourceAnchor.isContinuous) {
            sourceAnchor.setCurrentFace(sourceEdge);
        }

        if (targetAnchor.isContinuous) {
            targetAnchor.setCurrentFace(targetEdge);
        }

// --------------------------------------------------------------------------------------

        return {
            a: [ sourceEdge, targetEdge ],
            theta: theta,
            theta2: theta2
        };
    };

    /**
     * Anchors model a position on some element at which an Endpoint may be located.  They began as a first class citizen of jsPlumb, ie. a user
     * was required to create these themselves, but over time this has been replaced by the concept of referring to them either by name (eg. "TopMiddle"),
     * or by an array describing their coordinates (eg. [ 0, 0.5, 0, -1 ], which is the same as "TopMiddle").  jsPlumb now handles all of the
     * creation of Anchors without user intervention.
     */
    _jp.Anchor = function (params) {
        this.x = params.x || 0;
        this.y = params.y || 0;
        this.elementId = params.elementId;
        this.cssClass = params.cssClass || "";
        this.userDefinedLocation = null;
        this.orientation = params.orientation || [ 0, 0 ];
        this.lastReturnValue = null;
        this.offsets = params.offsets || [ 0, 0 ];
        this.timestamp = null;

        var relocatable = params.relocatable !== false;
        this.isRelocatable = function() { return relocatable; };
        this.setRelocatable = function(_relocatable) { relocatable = _relocatable; };
        var snapOnRelocate = params.snapOnRelocate !== false;
        this.isSnapOnRelocate = function() { return snapOnRelocate; };

        var locked = false;
        this.lock = function() { locked = true; };
        this.unlock = function() { locked = false; };
        this.isLocked = function() { return locked; };

        _ju.EventGenerator.apply(this);

        this.compute = function (params) {

            var xy = params.xy, wh = params.wh, timestamp = params.timestamp;

            if (params.clearUserDefinedLocation) {
                this.userDefinedLocation = null;
            }

            if (timestamp && timestamp === this.timestamp) {
                return this.lastReturnValue;
            }

            if (this.userDefinedLocation != null) {
                this.lastReturnValue = this.userDefinedLocation;
            }
            else {
                this.lastReturnValue = [ xy[0] + (this.x * wh[0]) + this.offsets[0], xy[1] + (this.y * wh[1]) + this.offsets[1], this.x, this.y ];
            }

            this.timestamp = timestamp;
            return this.lastReturnValue;
        };

        this.getCurrentLocation = function (params) {
            params = params || {};
            return (this.lastReturnValue == null || (params.timestamp != null && this.timestamp !== params.timestamp)) ? this.compute(params) : this.lastReturnValue;
        };

        this.setPosition = function(x, y, ox, oy, overrideLock) {
            if (!locked || overrideLock) {
                this.x = x;
                this.y = y;
                this.orientation = [ ox, oy ];
                this.lastReturnValue = null;
            }
        };
    };
    _ju.extend(_jp.Anchor, _ju.EventGenerator, {
        equals: function (anchor) {
            if (!anchor) {
                return false;
            }
            var ao = anchor.getOrientation(),
                o = this.getOrientation();
            return this.x === anchor.x && this.y === anchor.y && this.offsets[0] === anchor.offsets[0] && this.offsets[1] === anchor.offsets[1] && o[0] === ao[0] && o[1] === ao[1];
        },
        getUserDefinedLocation: function () {
            return this.userDefinedLocation;
        },
        setUserDefinedLocation: function (l) {
            this.userDefinedLocation = l;
        },
        clearUserDefinedLocation: function () {
            this.userDefinedLocation = null;
        },
        getOrientation: function () {
            return this.orientation;
        },
        getCssClass: function () {
            return this.cssClass;
        }
    });

    /**
     * An Anchor that floats. its orientation is computed dynamically from
     * its position relative to the anchor it is floating relative to.  It is used when creating
     * a connection through drag and drop.
     *
     * TODO FloatingAnchor could totally be refactored to extend Anchor just slightly.
     */
    _jp.FloatingAnchor = function (params) {

        _jp.Anchor.apply(this, arguments);

        // this is the anchor that this floating anchor is referenced to for
        // purposes of calculating the orientation.
        var ref = params.reference,
            // the canvas this refers to.
            refCanvas = params.referenceCanvas,
            size = _jp.getSize(refCanvas),
            // these are used to store the current relative position of our
            // anchor wrt the reference anchor. they only indicate
            // direction, so have a value of 1 or -1 (or, very rarely, 0). these
            // values are written by the compute method, and read
            // by the getOrientation method.
            xDir = 0, yDir = 0,
            // temporary member used to store an orientation when the floating
            // anchor is hovering over another anchor.
            orientation = null,
            _lastResult = null;

        // clear from parent. we want floating anchor orientation to always be computed.
        this.orientation = null;

        // set these to 0 each; they are used by certain types of connectors in the loopback case,
        // when the connector is trying to clear the element it is on. but for floating anchor it's not
        // very important.
        this.x = 0;
        this.y = 0;

        this.isFloating = true;

        this.compute = function (params) {
            var xy = params.xy,
                result = [ xy[0] + (size[0] / 2), xy[1] + (size[1] / 2) ]; // return origin of the element. we may wish to improve this so that any object can be the drag proxy.
            _lastResult = result;
            return result;
        };

        this.getOrientation = function (_endpoint) {
            if (orientation) {
                return orientation;
            }
            else {
                var o = ref.getOrientation(_endpoint);
                // here we take into account the orientation of the other
                // anchor: if it declares zero for some direction, we declare zero too. this might not be the most awesome. perhaps we can come
                // up with a better way. it's just so that the line we draw looks like it makes sense. maybe this wont make sense.
                return [ Math.abs(o[0]) * xDir * -1,
                    Math.abs(o[1]) * yDir * -1 ];
            }
        };

        /**
         * notification the endpoint associated with this anchor is hovering
         * over another anchor; we want to assume that anchor's orientation
         * for the duration of the hover.
         */
        this.over = function (anchor, endpoint) {
            orientation = anchor.getOrientation(endpoint);
        };

        /**
         * notification the endpoint associated with this anchor is no
         * longer hovering over another anchor; we should resume calculating
         * orientation as we normally do.
         */
        this.out = function () {
            orientation = null;
        };

        this.getCurrentLocation = function (params) {
            return _lastResult == null ? this.compute(params) : _lastResult;
        };
    };
    _ju.extend(_jp.FloatingAnchor, _jp.Anchor);

    var _convertAnchor = function (anchor, jsPlumbInstance, elementId) {
        return anchor.constructor === _jp.Anchor ? anchor : jsPlumbInstance.makeAnchor(anchor, elementId, jsPlumbInstance);
    };

    /* 
     * A DynamicAnchor is an Anchor that contains a list of other Anchors, which it cycles
     * through at compute time to find the one that is located closest to
     * the center of the target element, and returns that Anchor's compute
     * method result. this causes endpoints to follow each other with
     * respect to the orientation of their target elements, which is a useful
     * feature for some applications.
     * 
     */
    _jp.DynamicAnchor = function (params) {
        _jp.Anchor.apply(this, arguments);

        this.isDynamic = true;
        this.anchors = [];
        this.elementId = params.elementId;
        this.jsPlumbInstance = params.jsPlumbInstance;

        for (var i = 0; i < params.anchors.length; i++) {
            this.anchors[i] = _convertAnchor(params.anchors[i], this.jsPlumbInstance, this.elementId);
        }

        this.getAnchors = function () {
            return this.anchors;
        };

        var _curAnchor = this.anchors.length > 0 ? this.anchors[0] : null,
            _lastAnchor = _curAnchor,
            self = this,

            // helper method to calculate the distance between the centers of the two elements.
            _distance = function (anchor, cx, cy, xy, wh) {
                var ax = xy[0] + (anchor.x * wh[0]), ay = xy[1] + (anchor.y * wh[1]),
                    acx = xy[0] + (wh[0] / 2), acy = xy[1] + (wh[1] / 2);
                return (Math.sqrt(Math.pow(cx - ax, 2) + Math.pow(cy - ay, 2)) +
                Math.sqrt(Math.pow(acx - ax, 2) + Math.pow(acy - ay, 2)));
            },
            // default method uses distance between element centers.  you can provide your own method in the dynamic anchor
            // constructor (and also to jsPlumb.makeDynamicAnchor). the arguments to it are four arrays:
            // xy - xy loc of the anchor's element
            // wh - anchor's element's dimensions
            // txy - xy loc of the element of the other anchor in the connection
            // twh - dimensions of the element of the other anchor in the connection.
            // anchors - the list of selectable anchors
            _anchorSelector = params.selector || function (xy, wh, txy, twh, anchors) {
                    var cx = txy[0] + (twh[0] / 2), cy = txy[1] + (twh[1] / 2);
                    var minIdx = -1, minDist = Infinity;
                    for (var i = 0; i < anchors.length; i++) {
                        var d = _distance(anchors[i], cx, cy, xy, wh);
                        if (d < minDist) {
                            minIdx = i + 0;
                            minDist = d;
                        }
                    }
                    return anchors[minIdx];
                };

        this.compute = function (params) {
            var xy = params.xy, wh = params.wh, txy = params.txy, twh = params.twh;

            this.timestamp = params.timestamp;

            var udl = self.getUserDefinedLocation();
            if (udl != null) {
                return udl;
            }

            // if anchor is locked or an opposite element was not given, we
            // maintain our state. anchor will be locked
            // if it is the source of a drag and drop.
            if (this.isLocked() || txy == null || twh == null) {
                return _curAnchor.compute(params);
            }
            else {
                params.timestamp = null; // otherwise clear this, i think. we want the anchor to compute.
            }

            _curAnchor = _anchorSelector(xy, wh, txy, twh, this.anchors);
            this.x = _curAnchor.x;
            this.y = _curAnchor.y;

            if (_curAnchor !== _lastAnchor) {
                this.fire("anchorChanged", _curAnchor);
            }

            _lastAnchor = _curAnchor;

            return _curAnchor.compute(params);
        };

        this.getCurrentLocation = function (params) {
            return this.getUserDefinedLocation() || (_curAnchor != null ? _curAnchor.getCurrentLocation(params) : null);
        };

        this.getOrientation = function (_endpoint) {
            return _curAnchor != null ? _curAnchor.getOrientation(_endpoint) : [ 0, 0 ];
        };
        this.over = function (anchor, endpoint) {
            if (_curAnchor != null) {
                _curAnchor.over(anchor, endpoint);
            }
        };
        this.out = function () {
            if (_curAnchor != null) {
                _curAnchor.out();
            }
        };

        this.setAnchor = function(a) {
            _curAnchor = a;
        };

        this.getCssClass = function () {
            return (_curAnchor && _curAnchor.getCssClass()) || "";
        };

        /**
         * Attempt to match an anchor with the given coordinates and then set it.
         * @param coords
         * @returns true if matching anchor found, false otherwise.
         */
        this.setAnchorCoordinates = function(coords) {
            var idx = jsPlumbUtil.findWithFunction(this.anchors, function(a) {
                return a.x === coords[0] && a.y === coords[1];
            });
            if (idx !== -1) {
                this.setAnchor(this.anchors[idx]);
                return true;
            } else {
                return false;
            }
        };
    };
    _ju.extend(_jp.DynamicAnchor, _jp.Anchor);

// -------- basic anchors ------------------    
    var _curryAnchor = function (x, y, ox, oy, type, fnInit) {
        _jp.Anchors[type] = function (params) {
            var a = params.jsPlumbInstance.makeAnchor([ x, y, ox, oy, 0, 0 ], params.elementId, params.jsPlumbInstance);
            a.type = type;
            if (fnInit) {
                fnInit(a, params);
            }
            return a;
        };
    };

    _curryAnchor(0.5, 0, 0, -1, "TopCenter");
    _curryAnchor(0.5, 1, 0, 1, "BottomCenter");
    _curryAnchor(0, 0.5, -1, 0, "LeftMiddle");
    _curryAnchor(1, 0.5, 1, 0, "RightMiddle");

    _curryAnchor(0.5, 0, 0, -1, "Top");
    _curryAnchor(0.5, 1, 0, 1, "Bottom");
    _curryAnchor(0, 0.5, -1, 0, "Left");
    _curryAnchor(1, 0.5, 1, 0, "Right");
    _curryAnchor(0.5, 0.5, 0, 0, "Center");
    _curryAnchor(1, 0, 0, -1, "TopRight");
    _curryAnchor(1, 1, 0, 1, "BottomRight");
    _curryAnchor(0, 0, 0, -1, "TopLeft");
    _curryAnchor(0, 1, 0, 1, "BottomLeft");

// ------- dynamic anchors -------------------    

    // default dynamic anchors chooses from Top, Right, Bottom, Left
    _jp.Defaults.DynamicAnchors = function (params) {
        return params.jsPlumbInstance.makeAnchors(["TopCenter", "RightMiddle", "BottomCenter", "LeftMiddle"], params.elementId, params.jsPlumbInstance);
    };

    // default dynamic anchors bound to name 'AutoDefault'
    _jp.Anchors.AutoDefault = function (params) {
        var a = params.jsPlumbInstance.makeDynamicAnchor(_jp.Defaults.DynamicAnchors(params));
        a.type = "AutoDefault";
        return a;
    };

// ------- continuous anchors -------------------    

    var _curryContinuousAnchor = function (type, faces) {
        _jp.Anchors[type] = function (params) {
            var a = params.jsPlumbInstance.makeAnchor(["Continuous", { faces: faces }], params.elementId, params.jsPlumbInstance);
            a.type = type;
            return a;
        };
    };

    _jp.Anchors.Continuous = function (params) {
        return params.jsPlumbInstance.continuousAnchorFactory.get(params);
    };

    _curryContinuousAnchor("ContinuousLeft", ["left"]);
    _curryContinuousAnchor("ContinuousTop", ["top"]);
    _curryContinuousAnchor("ContinuousBottom", ["bottom"]);
    _curryContinuousAnchor("ContinuousRight", ["right"]);

// ------- position assign anchors -------------------    

    // this anchor type lets you assign the position at connection time.
    _curryAnchor(0, 0, 0, 0, "Assign", function (anchor, params) {
        // find what to use as the "position finder". the user may have supplied a String which represents
        // the id of a position finder in jsPlumb.AnchorPositionFinders, or the user may have supplied the
        // position finder as a function.  we find out what to use and then set it on the anchor.
        var pf = params.position || "Fixed";
        anchor.positionFinder = pf.constructor === String ? params.jsPlumbInstance.AnchorPositionFinders[pf] : pf;
        // always set the constructor params; the position finder might need them later (the Grid one does,
        // for example)
        anchor.constructorParams = params;
    });

    // these are the default anchor positions finders, which are used by the makeTarget function.  supplying
    // a position finder argument to that function allows you to specify where the resulting anchor will
    // be located
    root.jsPlumbInstance.prototype.AnchorPositionFinders = {
        "Fixed": function (dp, ep, es) {
            return [ (dp.left - ep.left) / es[0], (dp.top - ep.top) / es[1] ];
        },
        "Grid": function (dp, ep, es, params) {
            var dx = dp.left - ep.left, dy = dp.top - ep.top,
                gx = es[0] / (params.grid[0]), gy = es[1] / (params.grid[1]),
                mx = Math.floor(dx / gx), my = Math.floor(dy / gy);
            return [ ((mx * gx) + (gx / 2)) / es[0], ((my * gy) + (gy / 2)) / es[1] ];
        }
    };

// ------- perimeter anchors -------------------    

    _jp.Anchors.Perimeter = function (params) {
        params = params || {};
        var anchorCount = params.anchorCount || 60,
            shape = params.shape;

        if (!shape) {
            throw new Error("no shape supplied to Perimeter Anchor type");
        }

        var _circle = function () {
                var r = 0.5, step = Math.PI * 2 / anchorCount, current = 0, a = [];
                for (var i = 0; i < anchorCount; i++) {
                    var x = r + (r * Math.sin(current)),
                        y = r + (r * Math.cos(current));
                    a.push([ x, y, 0, 0 ]);
                    current += step;
                }
                return a;
            },
            _path = function (segments) {
                var anchorsPerFace = anchorCount / segments.length, a = [],
                    _computeFace = function (x1, y1, x2, y2, fractionalLength) {
                        anchorsPerFace = anchorCount * fractionalLength;
                        var dx = (x2 - x1) / anchorsPerFace, dy = (y2 - y1) / anchorsPerFace;
                        for (var i = 0; i < anchorsPerFace; i++) {
                            a.push([
                                x1 + (dx * i),
                                y1 + (dy * i),
                                0,
                                0
                            ]);
                        }
                    };

                for (var i = 0; i < segments.length; i++) {
                    _computeFace.apply(null, segments[i]);
                }

                return a;
            },
            _shape = function (faces) {
                var s = [];
                for (var i = 0; i < faces.length; i++) {
                    s.push([faces[i][0], faces[i][1], faces[i][2], faces[i][3], 1 / faces.length]);
                }
                return _path(s);
            },
            _rectangle = function () {
                return _shape([
                    [ 0, 0, 1, 0 ],
                    [ 1, 0, 1, 1 ],
                    [ 1, 1, 0, 1 ],
                    [ 0, 1, 0, 0 ]
                ]);
            };

        var _shapes = {
                "Circle": _circle,
                "Ellipse": _circle,
                "Diamond": function () {
                    return _shape([
                        [ 0.5, 0, 1, 0.5 ],
                        [ 1, 0.5, 0.5, 1 ],
                        [ 0.5, 1, 0, 0.5 ],
                        [ 0, 0.5, 0.5, 0 ]
                    ]);
                },
                "Rectangle": _rectangle,
                "Square": _rectangle,
                "Triangle": function () {
                    return _shape([
                        [ 0.5, 0, 1, 1 ],
                        [ 1, 1, 0, 1 ],
                        [ 0, 1, 0.5, 0]
                    ]);
                },
                "Path": function (params) {
                    var points = params.points, p = [], tl = 0;
                    for (var i = 0; i < points.length - 1; i++) {
                        var l = Math.sqrt(Math.pow(points[i][2] - points[i][0]) + Math.pow(points[i][3] - points[i][1]));
                        tl += l;
                        p.push([points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], l]);
                    }
                    for (var j = 0; j < p.length; j++) {
                        p[j][4] = p[j][4] / tl;
                    }
                    return _path(p);
                }
            },
            _rotate = function (points, amountInDegrees) {
                var o = [], theta = amountInDegrees / 180 * Math.PI;
                for (var i = 0; i < points.length; i++) {
                    var _x = points[i][0] - 0.5,
                        _y = points[i][1] - 0.5;

                    o.push([
                        0.5 + ((_x * Math.cos(theta)) - (_y * Math.sin(theta))),
                        0.5 + ((_x * Math.sin(theta)) + (_y * Math.cos(theta))),
                        points[i][2],
                        points[i][3]
                    ]);
                }
                return o;
            };

        if (!_shapes[shape]) {
            throw new Error("Shape [" + shape + "] is unknown by Perimeter Anchor type");
        }

        var da = _shapes[shape](params);
        if (params.rotation) {
            da = _rotate(da, params.rotation);
        }
        var a = params.jsPlumbInstance.makeDynamicAnchor(da);
        a.type = "Perimeter";
        return a;
    };
}).call(typeof window !== 'undefined' ? window : this);
/*
 * This file contains the default Connectors, Endpoint and Overlay definitions.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 * 
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 * 
 * Dual licensed under the MIT and GPL2 licenses.
 */
;
(function () {

    "use strict";
    var root = this, _jp = root.jsPlumb, _ju = root.jsPlumbUtil, _jg = root.Biltong;

    _jp.Segments = {

        /*
         * Class: AbstractSegment
         * A Connector is made up of 1..N Segments, each of which has a Type, such as 'Straight', 'Arc',
         * 'Bezier'. This is new from 1.4.2, and gives us a lot more flexibility when drawing connections: things such
         * as rounded corners for flowchart connectors, for example, or a straight line stub for Bezier connections, are
         * much easier to do now.
         *
         * A Segment is responsible for providing coordinates for painting it, and also must be able to report its length.
         * 
         */
        AbstractSegment: function (params) {
            this.params = params;

            /**
             * Function: findClosestPointOnPath
             * Finds the closest point on this segment to the given [x, y],
             * returning both the x and y of the point plus its distance from
             * the supplied point, and its location along the length of the
             * path inscribed by the segment.  This implementation returns
             * Infinity for distance and null values for everything else;
             * subclasses are expected to override.
             */
            this.findClosestPointOnPath = function (x, y) {
                return {
                    d: Infinity,
                    x: null,
                    y: null,
                    l: null
                };
            };

            this.getBounds = function () {
                return {
                    minX: Math.min(params.x1, params.x2),
                    minY: Math.min(params.y1, params.y2),
                    maxX: Math.max(params.x1, params.x2),
                    maxY: Math.max(params.y1, params.y2)
                };
            };

            /**
             * Computes the list of points on the segment that intersect the given line.
             * @method lineIntersection
             * @param {number} x1
             * @param {number} y1
             * @param {number} x2
             * @param {number} y2
             * @returns {Array<[number, number]>}
             */
            this.lineIntersection = function(x1, y1, x2, y2) {
                return [];
            };

            /**
             * Computes the list of points on the segment that intersect the box with the given origin and size.
             * @method boxIntersection
             * @param {number} x1
             * @param {number} y1
             * @param {number} w
             * @param {number} h
             * @returns {Array<[number, number]>}
             */
            this.boxIntersection = function(x, y, w, h) {
                var a = [];
                a.push.apply(a, this.lineIntersection(x, y, x + w, y));
                a.push.apply(a, this.lineIntersection(x + w, y, x + w, y + h));
                a.push.apply(a, this.lineIntersection(x + w, y + h, x, y + h));
                a.push.apply(a, this.lineIntersection(x, y + h, x, y));
                return a;
            };

            /**
             * Computes the list of points on the segment that intersect the given bounding box, which is an object of the form { x:.., y:.., w:.., h:.. }.
             * @method lineIntersection
             * @param {BoundingRectangle} box
             * @returns {Array<[number, number]>}
             */
            this.boundingBoxIntersection = function(box) {
                return this.boxIntersection(box.x, box.y, box.w, box.y);
            };
        },
        Straight: function (params) {
            var _super = _jp.Segments.AbstractSegment.apply(this, arguments),
                length, m, m2, x1, x2, y1, y2,
                _recalc = function () {
                    length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                    m = _jg.gradient({x: x1, y: y1}, {x: x2, y: y2});
                    m2 = -1 / m;
                };

            this.type = "Straight";

            this.getLength = function () {
                return length;
            };
            this.getGradient = function () {
                return m;
            };

            this.getCoordinates = function () {
                return { x1: x1, y1: y1, x2: x2, y2: y2 };
            };
            this.setCoordinates = function (coords) {
                x1 = coords.x1;
                y1 = coords.y1;
                x2 = coords.x2;
                y2 = coords.y2;
                _recalc();
            };
            this.setCoordinates({x1: params.x1, y1: params.y1, x2: params.x2, y2: params.y2});

            this.getBounds = function () {
                return {
                    minX: Math.min(x1, x2),
                    minY: Math.min(y1, y2),
                    maxX: Math.max(x1, x2),
                    maxY: Math.max(y1, y2)
                };
            };

            /**
             * returns the point on the segment's path that is 'location' along the length of the path, where 'location' is a decimal from
             * 0 to 1 inclusive. for the straight line segment this is simple maths.
             */
            this.pointOnPath = function (location, absolute) {
                if (location === 0 && !absolute) {
                    return { x: x1, y: y1 };
                }
                else if (location === 1 && !absolute) {
                    return { x: x2, y: y2 };
                }
                else {
                    var l = absolute ? location > 0 ? location : length + location : location * length;
                    return _jg.pointOnLine({x: x1, y: y1}, {x: x2, y: y2}, l);
                }
            };

            /**
             * returns the gradient of the segment at the given point - which for us is constant.
             */
            this.gradientAtPoint = function (_) {
                return m;
            };

            /**
             * returns the point on the segment's path that is 'distance' along the length of the path from 'location', where
             * 'location' is a decimal from 0 to 1 inclusive, and 'distance' is a number of pixels.
             * this hands off to jsPlumbUtil to do the maths, supplying two points and the distance.
             */
            this.pointAlongPathFrom = function (location, distance, absolute) {
                var p = this.pointOnPath(location, absolute),
                    farAwayPoint = distance <= 0 ? {x: x1, y: y1} : {x: x2, y: y2 };

                /*
                 location == 1 ? {
                 x:x1 + ((x2 - x1) * 10),
                 y:y1 + ((y1 - y2) * 10)
                 } :
                 */

                if (distance <= 0 && Math.abs(distance) > 1) {
                    distance *= -1;
                }

                return _jg.pointOnLine(p, farAwayPoint, distance);
            };

            // is c between a and b?
            var within = function (a, b, c) {
                return c >= Math.min(a, b) && c <= Math.max(a, b);
            };
            // find which of a and b is closest to c
            var closest = function (a, b, c) {
                return Math.abs(c - a) < Math.abs(c - b) ? a : b;
            };

            /**
             Function: findClosestPointOnPath
             Finds the closest point on this segment to [x,y]. See
             notes on this method in AbstractSegment.
             */
            this.findClosestPointOnPath = function (x, y) {
                var out = {
                    d: Infinity,
                    x: null,
                    y: null,
                    l: null,
                    x1: x1,
                    x2: x2,
                    y1: y1,
                    y2: y2
                };

                if (m === 0) {
                    out.y = y1;
                    out.x = within(x1, x2, x) ? x : closest(x1, x2, x);
                }
                else if (m === Infinity || m === -Infinity) {
                    out.x = x1;
                    out.y = within(y1, y2, y) ? y : closest(y1, y2, y);
                }
                else {
                    // closest point lies on normal from given point to this line.  
                    var b = y1 - (m * x1),
                        b2 = y - (m2 * x),
                    // y1 = m.x1 + b and y1 = m2.x1 + b2
                    // so m.x1 + b = m2.x1 + b2
                    // x1(m - m2) = b2 - b
                    // x1 = (b2 - b) / (m - m2)
                        _x1 = (b2 - b) / (m - m2),
                        _y1 = (m * _x1) + b;

                    out.x = within(x1, x2, _x1) ? _x1 : closest(x1, x2, _x1);//_x1;
                    out.y = within(y1, y2, _y1) ? _y1 : closest(y1, y2, _y1);//_y1;
                }

                var fractionInSegment = _jg.lineLength([ out.x, out.y ], [ x1, y1 ]);
                out.d = _jg.lineLength([x, y], [out.x, out.y]);
                out.l = fractionInSegment / length;
                return out;
            };

            var _pointLiesBetween = function(q, p1, p2) {
                return (p2 > p1) ? (p1 <= q && q <= p2) : (p1 >= q && q >= p2);
            }, _plb = _pointLiesBetween;

            /**
             * Calculates all intersections of the given line with this segment.
             * @param _x1
             * @param _y1
             * @param _x2
             * @param _y2
             * @returns {Array}
             */
            this.lineIntersection = function(_x1, _y1, _x2, _y2) {
                var m2 = Math.abs(_jg.gradient({x: _x1, y: _y1}, {x: _x2, y: _y2})),
                    m1 = Math.abs(m),
                    b = m1 === Infinity ? x1 : y1 - (m1 * x1),
                    out = [],
                    b2 = m2 === Infinity ? _x1 : _y1 - (m2 * _x1);

                // if lines parallel, no intersection
                if  (m2 !== m1) {
                    // perpendicular, segment horizontal
                    if(m2 === Infinity  && m1 === 0) {
                        if (_plb(_x1, x1, x2) && _plb(y1, _y1, _y2)) {
                            out = [ _x1, y1 ];  // we return X on the incident line and Y from the segment
                        }
                    } else if(m2 === 0 && m1 === Infinity) {
                        // perpendicular, segment vertical
                        if(_plb(_y1, y1, y2) && _plb(x1, _x1, _x2)) {
                            out = [x1, _y1];  // we return X on the segment and Y from the incident line
                        }
                    } else {
                        var X, Y;
                        if (m2 === Infinity) {
                            // test line is a vertical line. where does it cross the segment?
                            X = _x1;
                            if (_plb(X, x1, x2)) {
                                Y = (m1 * _x1) + b;
                                if (_plb(Y, _y1, _y2)) {
                                    out = [ X, Y ];
                                }
                            }
                        } else if (m2 === 0) {
                            Y = _y1;
                            // test line is a horizontal line. where does it cross the segment?
                            if (_plb(Y, y1, y2)) {
                                X = (_y1 - b) / m1;
                                if (_plb(X, _x1, _x2)) {
                                    out = [ X, Y ];
                                }
                            }
                        } else {
                            // mX + b = m2X + b2
                            // mX - m2X = b2 - b
                            // X(m - m2) = b2 - b
                            // X = (b2 - b) / (m - m2)
                            // Y = mX + b
                            X = (b2 - b) / (m1 - m2);
                            Y = (m1 * X) + b;
                            if(_plb(X, x1, x2) && _plb(Y, y1, y2)) {
                                out = [ X,  Y];
                            }
                        }
                    }
                }

                return out;
            };

            /**
             * Calculates all intersections of the given box with this segment. By default this method simply calls `lineIntersection` with each of the four
             * faces of the box; subclasses can override this if they think there's a faster way to compute the entire box at once.
             * @param x X position of top left corner of box
             * @param y Y position of top left corner of box
             * @param w width of box
             * @param h height of box
             * @returns {Array}
             */
            this.boxIntersection = function(x, y, w, h) {
                var a = [];
                a.push.apply(a, this.lineIntersection(x, y, x + w, y));
                a.push.apply(a, this.lineIntersection(x + w, y, x + w, y + h));
                a.push.apply(a, this.lineIntersection(x + w, y + h, x, y + h));
                a.push.apply(a, this.lineIntersection(x, y + h, x, y));
                return a;
            };

            /**
             * Calculates all intersections of the given bounding box with this segment. By default this method simply calls `lineIntersection` with each of the four
             * faces of the box; subclasses can override this if they think there's a faster way to compute the entire box at once.
             * @param box Bounding box, in { x:.., y:..., w:..., h:... } format.
             * @returns {Array}
             */
            this.boundingBoxIntersection = function(box) {
                return this.boxIntersection(box.x, box.y, box.w, box.h);
            };
        },

        /*
         Arc Segment. You need to supply:

         r   -   radius
         cx  -   center x for the arc
         cy  -   center y for the arc
         ac  -   whether the arc is anticlockwise or not. default is clockwise.

         and then either:

         startAngle  -   startAngle for the arc.
         endAngle    -   endAngle for the arc.

         or:

         x1          -   x for start point
         y1          -   y for start point
         x2          -   x for end point
         y2          -   y for end point

         */
        Arc: function (params) {
            var _super = _jp.Segments.AbstractSegment.apply(this, arguments),
                _calcAngle = function (_x, _y) {
                    return _jg.theta([params.cx, params.cy], [_x, _y]);
                },
                _calcAngleForLocation = function (segment, location) {
                    if (segment.anticlockwise) {
                        var sa = segment.startAngle < segment.endAngle ? segment.startAngle + TWO_PI : segment.startAngle,
                            s = Math.abs(sa - segment.endAngle);
                        return sa - (s * location);
                    }
                    else {
                        var ea = segment.endAngle < segment.startAngle ? segment.endAngle + TWO_PI : segment.endAngle,
                            ss = Math.abs(ea - segment.startAngle);

                        return segment.startAngle + (ss * location);
                    }
                },
                TWO_PI = 2 * Math.PI;

            this.radius = params.r;
            this.anticlockwise = params.ac;
            this.type = "Arc";

            if (params.startAngle && params.endAngle) {
                this.startAngle = params.startAngle;
                this.endAngle = params.endAngle;
                this.x1 = params.cx + (this.radius * Math.cos(params.startAngle));
                this.y1 = params.cy + (this.radius * Math.sin(params.startAngle));
                this.x2 = params.cx + (this.radius * Math.cos(params.endAngle));
                this.y2 = params.cy + (this.radius * Math.sin(params.endAngle));
            }
            else {
                this.startAngle = _calcAngle(params.x1, params.y1);
                this.endAngle = _calcAngle(params.x2, params.y2);
                this.x1 = params.x1;
                this.y1 = params.y1;
                this.x2 = params.x2;
                this.y2 = params.y2;
            }

            if (this.endAngle < 0) {
                this.endAngle += TWO_PI;
            }
            if (this.startAngle < 0) {
                this.startAngle += TWO_PI;
            }

            // segment is used by vml     
            //this.segment = _jg.quadrant([this.x1, this.y1], [this.x2, this.y2]);

            // we now have startAngle and endAngle as positive numbers, meaning the
            // absolute difference (|d|) between them is the sweep (s) of this arc, unless the
            // arc is 'anticlockwise' in which case 's' is given by 2PI - |d|.

            var ea = this.endAngle < this.startAngle ? this.endAngle + TWO_PI : this.endAngle;
            this.sweep = Math.abs(ea - this.startAngle);
            if (this.anticlockwise) {
                this.sweep = TWO_PI - this.sweep;
            }
            var circumference = 2 * Math.PI * this.radius,
                frac = this.sweep / TWO_PI,
                length = circumference * frac;

            this.getLength = function () {
                return length;
            };

            this.getBounds = function () {
                return {
                    minX: params.cx - params.r,
                    maxX: params.cx + params.r,
                    minY: params.cy - params.r,
                    maxY: params.cy + params.r
                };
            };

            var VERY_SMALL_VALUE = 0.0000000001,
                gentleRound = function (n) {
                    var f = Math.floor(n), r = Math.ceil(n);
                    if (n - f < VERY_SMALL_VALUE) {
                        return f;
                    }
                    else if (r - n < VERY_SMALL_VALUE) {
                        return r;
                    }
                    return n;
                };

            /**
             * returns the point on the segment's path that is 'location' along the length of the path, where 'location' is a decimal from
             * 0 to 1 inclusive.
             */
            this.pointOnPath = function (location, absolute) {

                if (location === 0) {
                    return { x: this.x1, y: this.y1, theta: this.startAngle };
                }
                else if (location === 1) {
                    return { x: this.x2, y: this.y2, theta: this.endAngle };
                }

                if (absolute) {
                    location = location / length;
                }

                var angle = _calcAngleForLocation(this, location),
                    _x = params.cx + (params.r * Math.cos(angle)),
                    _y = params.cy + (params.r * Math.sin(angle));

                return { x: gentleRound(_x), y: gentleRound(_y), theta: angle };
            };

            /**
             * returns the gradient of the segment at the given point.
             */
            this.gradientAtPoint = function (location, absolute) {
                var p = this.pointOnPath(location, absolute);
                var m = _jg.normal([ params.cx, params.cy ], [p.x, p.y ]);
                if (!this.anticlockwise && (m === Infinity || m === -Infinity)) {
                    m *= -1;
                }
                return m;
            };

            this.pointAlongPathFrom = function (location, distance, absolute) {
                var p = this.pointOnPath(location, absolute),
                    arcSpan = distance / circumference * 2 * Math.PI,
                    dir = this.anticlockwise ? -1 : 1,
                    startAngle = p.theta + (dir * arcSpan),
                    startX = params.cx + (this.radius * Math.cos(startAngle)),
                    startY = params.cy + (this.radius * Math.sin(startAngle));

                return {x: startX, y: startY};
            };

            // TODO: lineIntersection
        },

        Bezier: function (params) {
            this.curve = [
                { x: params.x1, y: params.y1},
                { x: params.cp1x, y: params.cp1y },
                { x: params.cp2x, y: params.cp2y },
                { x: params.x2, y: params.y2 }
            ];

            var _super = _jp.Segments.AbstractSegment.apply(this, arguments);
            // although this is not a strictly rigorous determination of bounds
            // of a bezier curve, it works for the types of curves that this segment
            // type produces.
            this.bounds = {
                minX: Math.min(params.x1, params.x2, params.cp1x, params.cp2x),
                minY: Math.min(params.y1, params.y2, params.cp1y, params.cp2y),
                maxX: Math.max(params.x1, params.x2, params.cp1x, params.cp2x),
                maxY: Math.max(params.y1, params.y2, params.cp1y, params.cp2y)
            };

            this.type = "Bezier";

            var _translateLocation = function (_curve, location, absolute) {
                if (absolute) {
                    location = root.jsBezier.locationAlongCurveFrom(_curve, location > 0 ? 0 : 1, location);
                }

                return location;
            };

            /**
             * returns the point on the segment's path that is 'location' along the length of the path, where 'location' is a decimal from
             * 0 to 1 inclusive.
             */
            this.pointOnPath = function (location, absolute) {
                location = _translateLocation(this.curve, location, absolute);
                return root.jsBezier.pointOnCurve(this.curve, location);
            };

            /**
             * returns the gradient of the segment at the given point.
             */
            this.gradientAtPoint = function (location, absolute) {
                location = _translateLocation(this.curve, location, absolute);
                return root.jsBezier.gradientAtPoint(this.curve, location);
            };

            this.pointAlongPathFrom = function (location, distance, absolute) {
                location = _translateLocation(this.curve, location, absolute);
                return root.jsBezier.pointAlongCurveFrom(this.curve, location, distance);
            };

            this.getLength = function () {
                return root.jsBezier.getLength(this.curve);
            };

            this.getBounds = function () {
                return this.bounds;
            };

            this.findClosestPointOnPath = function (x, y) {
                var p = root.jsBezier.nearestPointOnCurve({x:x,y:y}, this.curve);
                return {
                    d:Math.sqrt(Math.pow(p.point.x - x, 2) + Math.pow(p.point.y - y, 2)),
                    x:p.point.x,
                    y:p.point.y,
                    l:p.location,
                    s:this
                };
            };

            this.lineIntersection = function(x1, y1, x2, y2) {
                return root.jsBezier.lineIntersection(x1, y1, x2, y2, this.curve);
            };
        }
    };

    _jp.SegmentRenderer = {
        getPath: function (segment, isFirstSegment) {
            return ({
                "Straight": function (isFirstSegment) {
                    var d = segment.getCoordinates();
                    return (isFirstSegment ? "M " + d.x1 + " " + d.y1 + " " : "") + "L " + d.x2 + " " + d.y2;
                },
                "Bezier": function (isFirstSegment) {
                    var d = segment.params;
                    return (isFirstSegment ? "M " + d.x2 + " " + d.y2 + " " : "") +
                        "C " + d.cp2x + " " + d.cp2y + " " + d.cp1x + " " + d.cp1y + " " + d.x1 + " " + d.y1;
                },
                "Arc": function (isFirstSegment) {
                    var d = segment.params,
                        laf = segment.sweep > Math.PI ? 1 : 0,
                        sf = segment.anticlockwise ? 0 : 1;

                    return  (isFirstSegment ? "M" + segment.x1 + " " + segment.y1  + " " : "")  + "A " + segment.radius + " " + d.r + " 0 " + laf + "," + sf + " " + segment.x2 + " " + segment.y2;
                }
            })[segment.type](isFirstSegment);
        }
    };

    /*
     Class: UIComponent
     Superclass for Connector and AbstractEndpoint.
     */
    var AbstractComponent = function () {
        this.resetBounds = function () {
            this.bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        };
        this.resetBounds();
    };

    /*
     * Class: Connector
     * Superclass for all Connectors; here is where Segments are managed.  This is exposed on jsPlumb just so it
     * can be accessed from other files. You should not try to instantiate one of these directly.
     *
     * When this class is asked for a pointOnPath, or gradient etc, it must first figure out which segment to dispatch
     * that request to. This is done by keeping track of the total connector length as segments are added, and also
     * their cumulative ratios to the total length.  Then when the right segment is found it is a simple case of dispatching
     * the request to it (and adjusting 'location' so that it is relative to the beginning of that segment.)
     */
    _jp.Connectors.AbstractConnector = function (params) {

        AbstractComponent.apply(this, arguments);

        var segments = [],
            totalLength = 0,
            segmentProportions = [],
            segmentProportionalLengths = [],
            stub = params.stub || 0,
            sourceStub = _ju.isArray(stub) ? stub[0] : stub,
            targetStub = _ju.isArray(stub) ? stub[1] : stub,
            gap = params.gap || 0,
            sourceGap = _ju.isArray(gap) ? gap[0] : gap,
            targetGap = _ju.isArray(gap) ? gap[1] : gap,
            userProvidedSegments = null,
            paintInfo = null;

        this.getPathData = function() {
            var p = "";
            for (var i = 0; i < segments.length; i++) {
                p += _jp.SegmentRenderer.getPath(segments[i], i === 0);
                p += " ";
            }
            return p;
        };

        /**
         * Function: findSegmentForPoint
         * Returns the segment that is closest to the given [x,y],
         * null if nothing found.  This function returns a JS
         * object with:
         *
         *   d   -   distance from segment
         *   l   -   proportional location in segment
         *   x   -   x point on the segment
         *   y   -   y point on the segment
         *   s   -   the segment itself.
         */
        this.findSegmentForPoint = function (x, y) {
            var out = { d: Infinity, s: null, x: null, y: null, l: null };
            for (var i = 0; i < segments.length; i++) {
                var _s = segments[i].findClosestPointOnPath(x, y);
                if (_s.d < out.d) {
                    out.d = _s.d;
                    out.l = _s.l;
                    out.x = _s.x;
                    out.y = _s.y;
                    out.s = segments[i];
                    out.x1 = _s.x1;
                    out.x2 = _s.x2;
                    out.y1 = _s.y1;
                    out.y2 = _s.y2;
                    out.index = i;
                }
            }

            return out;
        };

        this.lineIntersection = function(x1, y1, x2, y2) {
            var out = [];
            for (var i = 0; i < segments.length; i++) {
                out.push.apply(out, segments[i].lineIntersection(x1, y1, x2, y2));
            }
            return out;
        };

        this.boxIntersection = function(x, y, w, h) {
            var out = [];
            for (var i = 0; i < segments.length; i++) {
                out.push.apply(out, segments[i].boxIntersection(x, y, w, h));
            }
            return out;
        };

        this.boundingBoxIntersection = function(box) {
            var out = [];
            for (var i = 0; i < segments.length; i++) {
                out.push.apply(out, segments[i].boundingBoxIntersection(box));
            }
            return out;
        };

        var _updateSegmentProportions = function () {
                var curLoc = 0;
                for (var i = 0; i < segments.length; i++) {
                    var sl = segments[i].getLength();
                    segmentProportionalLengths[i] = sl / totalLength;
                    segmentProportions[i] = [curLoc, (curLoc += (sl / totalLength)) ];
                }
            },

            /**
             * returns [segment, proportion of travel in segment, segment index] for the segment
             * that contains the point which is 'location' distance along the entire path, where
             * 'location' is a decimal between 0 and 1 inclusive. in this connector type, paths
             * are made up of a list of segments, each of which contributes some fraction to
             * the total length.
             * From 1.3.10 this also supports the 'absolute' property, which lets us specify a location
             * as the absolute distance in pixels, rather than a proportion of the total path.
             */
            _findSegmentForLocation = function (location, absolute) {
                if (absolute) {
                    location = location > 0 ? location / totalLength : (totalLength + location) / totalLength;
                }
                var idx = segmentProportions.length - 1, inSegmentProportion = 1;
                for (var i = 0; i < segmentProportions.length; i++) {
                    if (segmentProportions[i][1] >= location) {
                        idx = i;
                        // todo is this correct for all connector path types?
                        inSegmentProportion = location === 1 ? 1 : location === 0 ? 0 : (location - segmentProportions[i][0]) / segmentProportionalLengths[i];
                        break;
                    }
                }
                return { segment: segments[idx], proportion: inSegmentProportion, index: idx };
            },
            _addSegment = function (conn, type, params) {
                if (params.x1 === params.x2 && params.y1 === params.y2) {
                    return;
                }
                var s = new _jp.Segments[type](params);
                segments.push(s);
                totalLength += s.getLength();
                conn.updateBounds(s);
            },
            _clearSegments = function () {
                totalLength = segments.length = segmentProportions.length = segmentProportionalLengths.length = 0;
            };

        this.setSegments = function (_segs) {
            userProvidedSegments = [];
            totalLength = 0;
            for (var i = 0; i < _segs.length; i++) {
                userProvidedSegments.push(_segs[i]);
                totalLength += _segs[i].getLength();
            }
        };

        this.getLength = function() {
            return totalLength;
        };

        var _prepareCompute = function (params) {
            this.strokeWidth = params.strokeWidth;
            var segment = _jg.quadrant(params.sourcePos, params.targetPos),
                swapX = params.targetPos[0] < params.sourcePos[0],
                swapY = params.targetPos[1] < params.sourcePos[1],
                lw = params.strokeWidth || 1,
                so = params.sourceEndpoint.anchor.getOrientation(params.sourceEndpoint),
                to = params.targetEndpoint.anchor.getOrientation(params.targetEndpoint),
                x = swapX ? params.targetPos[0] : params.sourcePos[0],
                y = swapY ? params.targetPos[1] : params.sourcePos[1],
                w = Math.abs(params.targetPos[0] - params.sourcePos[0]),
                h = Math.abs(params.targetPos[1] - params.sourcePos[1]);

            // if either anchor does not have an orientation set, we derive one from their relative
            // positions.  we fix the axis to be the one in which the two elements are further apart, and
            // point each anchor at the other element.  this is also used when dragging a new connection.
            if (so[0] === 0 && so[1] === 0 || to[0] === 0 && to[1] === 0) {
                var index = w > h ? 0 : 1, oIndex = [1, 0][index];
                so = [];
                to = [];
                so[index] = params.sourcePos[index] > params.targetPos[index] ? -1 : 1;
                to[index] = params.sourcePos[index] > params.targetPos[index] ? 1 : -1;
                so[oIndex] = 0;
                to[oIndex] = 0;
            }

            var sx = swapX ? w + (sourceGap * so[0]) : sourceGap * so[0],
                sy = swapY ? h + (sourceGap * so[1]) : sourceGap * so[1],
                tx = swapX ? targetGap * to[0] : w + (targetGap * to[0]),
                ty = swapY ? targetGap * to[1] : h + (targetGap * to[1]),
                oProduct = ((so[0] * to[0]) + (so[1] * to[1]));

            var result = {
                sx: sx, sy: sy, tx: tx, ty: ty, lw: lw,
                xSpan: Math.abs(tx - sx),
                ySpan: Math.abs(ty - sy),
                mx: (sx + tx) / 2,
                my: (sy + ty) / 2,
                so: so, to: to, x: x, y: y, w: w, h: h,
                segment: segment,
                startStubX: sx + (so[0] * sourceStub),
                startStubY: sy + (so[1] * sourceStub),
                endStubX: tx + (to[0] * targetStub),
                endStubY: ty + (to[1] * targetStub),
                isXGreaterThanStubTimes2: Math.abs(sx - tx) > (sourceStub + targetStub),
                isYGreaterThanStubTimes2: Math.abs(sy - ty) > (sourceStub + targetStub),
                opposite: oProduct === -1,
                perpendicular: oProduct === 0,
                orthogonal: oProduct === 1,
                sourceAxis: so[0] === 0 ? "y" : "x",
                points: [x, y, w, h, sx, sy, tx, ty ],
                stubs:[sourceStub, targetStub]
            };
            result.anchorOrientation = result.opposite ? "opposite" : result.orthogonal ? "orthogonal" : "perpendicular";
            return result;
        };

        this.getSegments = function () {
            return segments;
        };

        this.updateBounds = function (segment) {
            var segBounds = segment.getBounds();
            this.bounds.minX = Math.min(this.bounds.minX, segBounds.minX);
            this.bounds.maxX = Math.max(this.bounds.maxX, segBounds.maxX);
            this.bounds.minY = Math.min(this.bounds.minY, segBounds.minY);
            this.bounds.maxY = Math.max(this.bounds.maxY, segBounds.maxY);
        };

        var dumpSegmentsToConsole = function () {
            console.log("SEGMENTS:");
            for (var i = 0; i < segments.length; i++) {
                console.log(segments[i].type, segments[i].getLength(), segmentProportions[i]);
            }
        };

        this.pointOnPath = function (location, absolute) {
            var seg = _findSegmentForLocation(location, absolute);
            return seg.segment && seg.segment.pointOnPath(seg.proportion, false) || [0, 0];
        };

        this.gradientAtPoint = function (location, absolute) {
            var seg = _findSegmentForLocation(location, absolute);
            return seg.segment && seg.segment.gradientAtPoint(seg.proportion, false) || 0;
        };

        this.pointAlongPathFrom = function (location, distance, absolute) {
            var seg = _findSegmentForLocation(location, absolute);
            // TODO what happens if this crosses to the next segment?
            return seg.segment && seg.segment.pointAlongPathFrom(seg.proportion, distance, false) || [0, 0];
        };

        this.compute = function (params) {
            paintInfo = _prepareCompute.call(this, params);

            _clearSegments();
            this._compute(paintInfo, params);
            this.x = paintInfo.points[0];
            this.y = paintInfo.points[1];
            this.w = paintInfo.points[2];
            this.h = paintInfo.points[3];
            this.segment = paintInfo.segment;
            _updateSegmentProportions();
        };

        return {
            addSegment: _addSegment,
            prepareCompute: _prepareCompute,
            sourceStub: sourceStub,
            targetStub: targetStub,
            maxStub: Math.max(sourceStub, targetStub),
            sourceGap: sourceGap,
            targetGap: targetGap,
            maxGap: Math.max(sourceGap, targetGap)
        };
    };
    _ju.extend(_jp.Connectors.AbstractConnector, AbstractComponent);


    // ********************************* END OF CONNECTOR TYPES *******************************************************************

    // ********************************* ENDPOINT TYPES *******************************************************************

    _jp.Endpoints.AbstractEndpoint = function (params) {
        AbstractComponent.apply(this, arguments);
        var compute = this.compute = function (anchorPoint, orientation, endpointStyle, connectorPaintStyle) {
            var out = this._compute.apply(this, arguments);
            this.x = out[0];
            this.y = out[1];
            this.w = out[2];
            this.h = out[3];
            this.bounds.minX = this.x;
            this.bounds.minY = this.y;
            this.bounds.maxX = this.x + this.w;
            this.bounds.maxY = this.y + this.h;
            return out;
        };
        return {
            compute: compute,
            cssClass: params.cssClass
        };
    };
    _ju.extend(_jp.Endpoints.AbstractEndpoint, AbstractComponent);

    /**
     * Class: Endpoints.Dot
     * A round endpoint, with default radius 10 pixels.
     */

    /**
     * Function: Constructor
     *
     * Parameters:
     *
     *    radius    -    radius of the endpoint.  defaults to 10 pixels.
     */
    _jp.Endpoints.Dot = function (params) {
        this.type = "Dot";
        var _super = _jp.Endpoints.AbstractEndpoint.apply(this, arguments);
        params = params || {};
        this.radius = params.radius || 10;
        this.defaultOffset = 0.5 * this.radius;
        this.defaultInnerRadius = this.radius / 3;

        this._compute = function (anchorPoint, orientation, endpointStyle, connectorPaintStyle) {
            this.radius = endpointStyle.radius || this.radius;
            var x = anchorPoint[0] - this.radius,
                y = anchorPoint[1] - this.radius,
                w = this.radius * 2,
                h = this.radius * 2;

            if (endpointStyle.stroke) {
                var lw = endpointStyle.strokeWidth || 1;
                x -= lw;
                y -= lw;
                w += (lw * 2);
                h += (lw * 2);
            }
            return [ x, y, w, h, this.radius ];
        };
    };
    _ju.extend(_jp.Endpoints.Dot, _jp.Endpoints.AbstractEndpoint);

    _jp.Endpoints.Rectangle = function (params) {
        this.type = "Rectangle";
        var _super = _jp.Endpoints.AbstractEndpoint.apply(this, arguments);
        params = params || {};
        this.width = params.width || 20;
        this.height = params.height || 20;

        this._compute = function (anchorPoint, orientation, endpointStyle, connectorPaintStyle) {
            var width = endpointStyle.width || this.width,
                height = endpointStyle.height || this.height,
                x = anchorPoint[0] - (width / 2),
                y = anchorPoint[1] - (height / 2);

            return [ x, y, width, height];
        };
    };
    _ju.extend(_jp.Endpoints.Rectangle, _jp.Endpoints.AbstractEndpoint);

    var DOMElementEndpoint = function (params) {
        _jp.jsPlumbUIComponent.apply(this, arguments);
        this._jsPlumb.displayElements = [];
    };
    _ju.extend(DOMElementEndpoint, _jp.jsPlumbUIComponent, {
        getDisplayElements: function () {
            return this._jsPlumb.displayElements;
        },
        appendDisplayElement: function (el) {
            this._jsPlumb.displayElements.push(el);
        }
    });

    /**
     * Class: Endpoints.Image
     * Draws an image as the Endpoint.
     */
    /**
     * Function: Constructor
     *
     * Parameters:
     *
     *    src    -    location of the image to use.

     TODO: multiple references to self. not sure quite how to get rid of them entirely. perhaps self = null in the cleanup
     function will suffice

     TODO this class still might leak memory.

     */
    _jp.Endpoints.Image = function (params) {

        this.type = "Image";
        DOMElementEndpoint.apply(this, arguments);
        _jp.Endpoints.AbstractEndpoint.apply(this, arguments);

        var _onload = params.onload,
            src = params.src || params.url,
            clazz = params.cssClass ? " " + params.cssClass : "";

        this._jsPlumb.img = new Image();
        this._jsPlumb.ready = false;
        this._jsPlumb.initialized = false;
        this._jsPlumb.deleted = false;
        this._jsPlumb.widthToUse = params.width;
        this._jsPlumb.heightToUse = params.height;
        this._jsPlumb.endpoint = params.endpoint;

        this._jsPlumb.img.onload = function () {
            if (this._jsPlumb != null) {
                this._jsPlumb.ready = true;
                this._jsPlumb.widthToUse = this._jsPlumb.widthToUse || this._jsPlumb.img.width;
                this._jsPlumb.heightToUse = this._jsPlumb.heightToUse || this._jsPlumb.img.height;
                if (_onload) {
                    _onload(this);
                }
            }
        }.bind(this);

        /*
         Function: setImage
         Sets the Image to use in this Endpoint.

         Parameters:
         img         -   may be a URL or an Image object
         onload      -   optional; a callback to execute once the image has loaded.
         */
        this._jsPlumb.endpoint.setImage = function (_img, onload) {
            var s = _img.constructor === String ? _img : _img.src;
            _onload = onload;
            this._jsPlumb.img.src = s;

            if (this.canvas != null) {
                this.canvas.setAttribute("src", this._jsPlumb.img.src);
            }
        }.bind(this);

        this._jsPlumb.endpoint.setImage(src, _onload);
        this._compute = function (anchorPoint, orientation, endpointStyle, connectorPaintStyle) {
            this.anchorPoint = anchorPoint;
            if (this._jsPlumb.ready) {
                return [anchorPoint[0] - this._jsPlumb.widthToUse / 2, anchorPoint[1] - this._jsPlumb.heightToUse / 2,
                    this._jsPlumb.widthToUse, this._jsPlumb.heightToUse];
            }
            else {
                return [0, 0, 0, 0];
            }
        };

        this.canvas = _jp.createElement("img", {
            position:"absolute",
            margin:0,
            padding:0,
            outline:0
        }, this._jsPlumb.instance.endpointClass + clazz);

        if (this._jsPlumb.widthToUse) {
            this.canvas.setAttribute("width", this._jsPlumb.widthToUse);
        }
        if (this._jsPlumb.heightToUse) {
            this.canvas.setAttribute("height", this._jsPlumb.heightToUse);
        }
        this._jsPlumb.instance.appendElement(this.canvas);

        this.actuallyPaint = function (d, style, anchor) {
            if (!this._jsPlumb.deleted) {
                if (!this._jsPlumb.initialized) {
                    this.canvas.setAttribute("src", this._jsPlumb.img.src);
                    this.appendDisplayElement(this.canvas);
                    this._jsPlumb.initialized = true;
                }
                var x = this.anchorPoint[0] - (this._jsPlumb.widthToUse / 2),
                    y = this.anchorPoint[1] - (this._jsPlumb.heightToUse / 2);
                _ju.sizeElement(this.canvas, x, y, this._jsPlumb.widthToUse, this._jsPlumb.heightToUse);
            }
        };

        this.paint = function (style, anchor) {
            if (this._jsPlumb != null) {  // may have been deleted
                if (this._jsPlumb.ready) {
                    this.actuallyPaint(style, anchor);
                }
                else {
                    root.setTimeout(function () {
                        this.paint(style, anchor);
                    }.bind(this), 200);
                }
            }
        };
    };
    _ju.extend(_jp.Endpoints.Image, [ DOMElementEndpoint, _jp.Endpoints.AbstractEndpoint ], {
        cleanup: function (force) {
            if (force) {
                this._jsPlumb.deleted = true;
                if (this.canvas) {
                    this.canvas.parentNode.removeChild(this.canvas);
                }
                this.canvas = null;
            }
        }
    });

    /*
     * Class: Endpoints.Blank
     * An Endpoint that paints nothing (visible) on the screen.  Supports cssClass and hoverClass parameters like all Endpoints.
     */
    _jp.Endpoints.Blank = function (params) {
        var _super = _jp.Endpoints.AbstractEndpoint.apply(this, arguments);
        this.type = "Blank";
        DOMElementEndpoint.apply(this, arguments);
        this._compute = function (anchorPoint, orientation, endpointStyle, connectorPaintStyle) {
            return [anchorPoint[0], anchorPoint[1], 10, 0];
        };

        var clazz = params.cssClass ? " " + params.cssClass : "";

        this.canvas = _jp.createElement("div", {
            display: "block",
            width: "1px",
            height: "1px",
            background: "transparent",
            position: "absolute"
        }, this._jsPlumb.instance.endpointClass + clazz);

        this._jsPlumb.instance.appendElement(this.canvas);

        this.paint = function (style, anchor) {
            _ju.sizeElement(this.canvas, this.x, this.y, this.w, this.h);
        };
    };
    _ju.extend(_jp.Endpoints.Blank, [_jp.Endpoints.AbstractEndpoint, DOMElementEndpoint], {
        cleanup: function () {
            if (this.canvas && this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
            }
        }
    });

    /*
     * Class: Endpoints.Triangle
     * A triangular Endpoint.
     */
    /*
     * Function: Constructor
     *
     * Parameters:
     *
     * width   width of the triangle's base.  defaults to 55 pixels.
     * height  height of the triangle from base to apex.  defaults to 55 pixels.
     */
    _jp.Endpoints.Triangle = function (params) {
        this.type = "Triangle";
        _jp.Endpoints.AbstractEndpoint.apply(this, arguments);
        var self = this;
        params = params || {  };
        params.width = params.width || 55;
        params.height = params.height || 55;
        this.width = params.width;
        this.height = params.height;
        this._compute = function (anchorPoint, orientation, endpointStyle, connectorPaintStyle) {
            var width = endpointStyle.width || self.width,
                height = endpointStyle.height || self.height,
                x = anchorPoint[0] - (width / 2),
                y = anchorPoint[1] - (height / 2);
            return [ x, y, width, height ];
        };
    };
// ********************************* END OF ENDPOINT TYPES *******************************************************************


// ********************************* OVERLAY DEFINITIONS ***********************************************************************    

    var AbstractOverlay = _jp.Overlays.AbstractOverlay = function (params) {
        this.visible = true;
        this.isAppendedAtTopLevel = true;
        this.component = params.component;
        this.loc = params.location == null ? 0.5 : params.location;
        this.endpointLoc = params.endpointLocation == null ? [ 0.5, 0.5] : params.endpointLocation;
        this.visible = params.visible !== false;
    };
    AbstractOverlay.prototype = {
        cleanup: function (force) {
            if (force) {
                this.component = null;
                this.canvas = null;
                this.endpointLoc = null;
            }
        },
        reattach:function(instance, component) { },
        setVisible: function (val) {
            this.visible = val;
            this.component.repaint();
        },
        isVisible: function () {
            return this.visible;
        },
        hide: function () {
            this.setVisible(false);
        },
        show: function () {
            this.setVisible(true);
        },
        incrementLocation: function (amount) {
            this.loc += amount;
            this.component.repaint();
        },
        setLocation: function (l) {
            this.loc = l;
            this.component.repaint();
        },
        getLocation: function () {
            return this.loc;
        },
        updateFrom:function() { }
    };


    /*
     * Class: Overlays.Arrow
     *
     * An arrow overlay, defined by four points: the head, the two sides of the tail, and a 'foldback' point at some distance along the length
     * of the arrow that lines from each tail point converge into.  The foldback point is defined using a decimal that indicates some fraction
     * of the length of the arrow and has a default value of 0.623.  A foldback point value of 1 would mean that the arrow had a straight line
     * across the tail.
     */
    /*
     * @constructor
     *
     * @param {Object} params Constructor params.
     * @param {Number} [params.length] Distance in pixels from head to tail baseline. default 20.
     * @param {Number} [params.width] Width in pixels of the tail baseline. default 20.
     * @param {String} [params.fill] Style to use when filling the arrow.  defaults to "black".
     * @param {String} [params.stroke] Style to use when stroking the arrow. defaults to null, which means the arrow is not stroked.
     * @param {Number} [params.stroke-width] Line width to use when stroking the arrow. defaults to 1, but only used if stroke is not null.
     * @param {Number} [params.foldback] Distance (as a decimal from 0 to 1 inclusive) along the length of the arrow marking the point the tail points should fold back to.  defaults to 0.623.
     * @param {Number} [params.location] Distance (as a decimal from 0 to 1 inclusive) marking where the arrow should sit on the connector. defaults to 0.5.
     * @param {NUmber} [params.direction] Indicates the direction the arrow points in. valid values are -1 and 1; 1 is default.
     */
    _jp.Overlays.Arrow = function (params) {
        this.type = "Arrow";
        AbstractOverlay.apply(this, arguments);
        this.isAppendedAtTopLevel = false;
        params = params || {};
        var self = this;

        this.length = params.length || 20;
        this.width = params.width || 20;
        this.id = params.id;
        var direction = (params.direction || 1) < 0 ? -1 : 1,
            paintStyle = params.paintStyle || { "stroke-width": 1 },
        // how far along the arrow the lines folding back in come to. default is 62.3%.
            foldback = params.foldback || 0.623;

        this.computeMaxSize = function () {
            return self.width * 1.5;
        };

        this.elementCreated = function(p, component) {
            this.path = p;
            if (params.events) {
                for (var i in params.events) {
                    _jp.on(p, i, params.events[i]);
                }
            }
        };

        this.draw = function (component, currentConnectionPaintStyle) {

            var hxy, mid, txy, tail, cxy;
            if (component.pointAlongPathFrom) {

                if (_ju.isString(this.loc) || this.loc > 1 || this.loc < 0) {
                    var l = parseInt(this.loc, 10),
                        fromLoc = this.loc < 0 ? 1 : 0;
                    hxy = component.pointAlongPathFrom(fromLoc, l, false);
                    mid = component.pointAlongPathFrom(fromLoc, l - (direction * this.length / 2), false);
                    txy = _jg.pointOnLine(hxy, mid, this.length);
                }
                else if (this.loc === 1) {
                    hxy = component.pointOnPath(this.loc);
                    mid = component.pointAlongPathFrom(this.loc, -(this.length));
                    txy = _jg.pointOnLine(hxy, mid, this.length);

                    if (direction === -1) {
                        var _ = txy;
                        txy = hxy;
                        hxy = _;
                    }
                }
                else if (this.loc === 0) {
                    txy = component.pointOnPath(this.loc);
                    mid = component.pointAlongPathFrom(this.loc, this.length);
                    hxy = _jg.pointOnLine(txy, mid, this.length);
                    if (direction === -1) {
                        var __ = txy;
                        txy = hxy;
                        hxy = __;
                    }
                }
                else {
                    hxy = component.pointAlongPathFrom(this.loc, direction * this.length / 2);
                    mid = component.pointOnPath(this.loc);
                    txy = _jg.pointOnLine(hxy, mid, this.length);
                }

                tail = _jg.perpendicularLineTo(hxy, txy, this.width);
                cxy = _jg.pointOnLine(hxy, txy, foldback * this.length);

                var d = { hxy: hxy, tail: tail, cxy: cxy },
                    stroke = paintStyle.stroke || currentConnectionPaintStyle.stroke,
                    fill = paintStyle.fill || currentConnectionPaintStyle.stroke,
                    lineWidth = paintStyle.strokeWidth || currentConnectionPaintStyle.strokeWidth;

                return {
                    component: component,
                    d: d,
                    "stroke-width": lineWidth,
                    stroke: stroke,
                    fill: fill,
                    minX: Math.min(hxy.x, tail[0].x, tail[1].x),
                    maxX: Math.max(hxy.x, tail[0].x, tail[1].x),
                    minY: Math.min(hxy.y, tail[0].y, tail[1].y),
                    maxY: Math.max(hxy.y, tail[0].y, tail[1].y)
                };
            }
            else {
                return {component: component, minX: 0, maxX: 0, minY: 0, maxY: 0};
            }
        };
    };
    _ju.extend(_jp.Overlays.Arrow, AbstractOverlay, {
        updateFrom:function(d) {
            this.length = d.length || this.length;
            this.width = d.width|| this.width;
            this.direction = d.direction != null ? d.direction : this.direction;
            this.foldback = d.foldback|| this.foldback;
        },
        cleanup:function() {
            if (this.path && this.canvas) {
                this.canvas.removeChild(this.path);
            }
        }
    });

    /*
     * Class: Overlays.PlainArrow
     *
     * A basic arrow.  This is in fact just one instance of the more generic case in which the tail folds back on itself to some
     * point along the length of the arrow: in this case, that foldback point is the full length of the arrow.  so it just does
     * a 'call' to Arrow with foldback set appropriately.
     */
    /*
     * Function: Constructor
     * See <Overlays.Arrow> for allowed parameters for this overlay.
     */
    _jp.Overlays.PlainArrow = function (params) {
        params = params || {};
        var p = _jp.extend(params, {foldback: 1});
        _jp.Overlays.Arrow.call(this, p);
        this.type = "PlainArrow";
    };
    _ju.extend(_jp.Overlays.PlainArrow, _jp.Overlays.Arrow);

    /*
     * Class: Overlays.Diamond
     * 
     * A diamond. Like PlainArrow, this is a concrete case of the more generic case of the tail points converging on some point...it just
     * happens that in this case, that point is greater than the length of the the arrow.
     *
     *      this could probably do with some help with positioning...due to the way it reuses the Arrow paint code, what Arrow thinks is the
     *      center is actually 1/4 of the way along for this guy.  but we don't have any knowledge of pixels at this point, so we're kind of
     *      stuck when it comes to helping out the Arrow class. possibly we could pass in a 'transpose' parameter or something. the value
     *      would be -l/4 in this case - move along one quarter of the total length.
     */
    /*
     * Function: Constructor
     * See <Overlays.Arrow> for allowed parameters for this overlay.
     */
    _jp.Overlays.Diamond = function (params) {
        params = params || {};
        var l = params.length || 40,
            p = _jp.extend(params, {length: l / 2, foldback: 2});
        _jp.Overlays.Arrow.call(this, p);
        this.type = "Diamond";
    };
    _ju.extend(_jp.Overlays.Diamond, _jp.Overlays.Arrow);

    var _getDimensions = function (component, forceRefresh) {
        if (component._jsPlumb.cachedDimensions == null || forceRefresh) {
            component._jsPlumb.cachedDimensions = component.getDimensions();
        }
        return component._jsPlumb.cachedDimensions;
    };

    // abstract superclass for overlays that add an element to the DOM.
    var AbstractDOMOverlay = function (params) {
        _jp.jsPlumbUIComponent.apply(this, arguments);
        AbstractOverlay.apply(this, arguments);

        // hand off fired events to associated component.
        var _f = this.fire;
        this.fire = function () {
            _f.apply(this, arguments);
            if (this.component) {
                this.component.fire.apply(this.component, arguments);
            }
        };

        this.detached=false;
        this.id = params.id;
        this._jsPlumb.div = null;
        this._jsPlumb.initialised = false;
        this._jsPlumb.component = params.component;
        this._jsPlumb.cachedDimensions = null;
        this._jsPlumb.create = params.create;
        this._jsPlumb.initiallyInvisible = params.visible === false;

        this.getElement = function () {
            if (this._jsPlumb.div == null) {
                var div = this._jsPlumb.div = _jp.getElement(this._jsPlumb.create(this._jsPlumb.component));
                div.style.position = "absolute";
                jsPlumb.addClass(div, this._jsPlumb.instance.overlayClass + " " +
                    (this.cssClass ? this.cssClass :
                        params.cssClass ? params.cssClass : ""));
                this._jsPlumb.instance.appendElement(div);
                this._jsPlumb.instance.getId(div);
                this.canvas = div;

                // in IE the top left corner is what it placed at the desired location.  This will not
                // be fixed. IE8 is not going to be supported for much longer.
                var ts = "translate(-50%, -50%)";
                div.style.webkitTransform = ts;
                div.style.mozTransform = ts;
                div.style.msTransform = ts;
                div.style.oTransform = ts;
                div.style.transform = ts;

                // write the related component into the created element
                div._jsPlumb = this;

                if (params.visible === false) {
                    div.style.display = "none";
                }
            }
            return this._jsPlumb.div;
        };

        this.draw = function (component, currentConnectionPaintStyle, absolutePosition) {
            var td = _getDimensions(this);
            if (td != null && td.length === 2) {
                var cxy = { x: 0, y: 0 };

                // absolutePosition would have been set by a call to connection.setAbsoluteOverlayPosition.
                if (absolutePosition) {
                    cxy = { x: absolutePosition[0], y: absolutePosition[1] };
                }
                else if (component.pointOnPath) {
                    var loc = this.loc, absolute = false;
                    if (_ju.isString(this.loc) || this.loc < 0 || this.loc > 1) {
                        loc = parseInt(this.loc, 10);
                        absolute = true;
                    }
                    cxy = component.pointOnPath(loc, absolute);  // a connection
                }
                else {
                    var locToUse = this.loc.constructor === Array ? this.loc : this.endpointLoc;
                    cxy = { x: locToUse[0] * component.w,
                        y: locToUse[1] * component.h };
                }

                var minx = cxy.x - (td[0] / 2),
                    miny = cxy.y - (td[1] / 2);

                return {
                    component: component,
                    d: { minx: minx, miny: miny, td: td, cxy: cxy },
                    minX: minx,
                    maxX: minx + td[0],
                    minY: miny,
                    maxY: miny + td[1]
                };
            }
            else {
                return {minX: 0, maxX: 0, minY: 0, maxY: 0};
            }
        };
    };
    _ju.extend(AbstractDOMOverlay, [_jp.jsPlumbUIComponent, AbstractOverlay], {
        getDimensions: function () {
            return [1,1];
        },
        setVisible: function (state) {
            if (this._jsPlumb.div) {
                this._jsPlumb.div.style.display = state ? "block" : "none";
                // if initially invisible, dimensions are 0,0 and never get updated
                if (state && this._jsPlumb.initiallyInvisible) {
                    _getDimensions(this, true);
                    this.component.repaint();
                    this._jsPlumb.initiallyInvisible = false;
                }
            }
        },
        /*
         * Function: clearCachedDimensions
         * Clears the cached dimensions for the label. As a performance enhancement, label dimensions are
         * cached from 1.3.12 onwards. The cache is cleared when you change the label text, of course, but
         * there are other reasons why the text dimensions might change - if you make a change through CSS, for
         * example, you might change the font size.  in that case you should explicitly call this method.
         */
        clearCachedDimensions: function () {
            this._jsPlumb.cachedDimensions = null;
        },
        cleanup: function (force) {
            if (force) {
                if (this._jsPlumb.div != null) {
                    this._jsPlumb.div._jsPlumb = null;
                    this._jsPlumb.instance.removeElement(this._jsPlumb.div);
                }
            }
            else {
                // if not a forced cleanup, just detach child from parent for now.
                if (this._jsPlumb && this._jsPlumb.div && this._jsPlumb.div.parentNode) {
                    this._jsPlumb.div.parentNode.removeChild(this._jsPlumb.div);
                }
                this.detached = true;
            }

        },
        reattach:function(instance, component) {
            if (this._jsPlumb.div != null) {
                instance.getContainer().appendChild(this._jsPlumb.div);
            }
            this.detached = false;
        },
        computeMaxSize: function () {
            var td = _getDimensions(this);
            return Math.max(td[0], td[1]);
        },
        paint: function (p, containerExtents) {
            if (!this._jsPlumb.initialised) {
                this.getElement();
                p.component.appendDisplayElement(this._jsPlumb.div);
                this._jsPlumb.initialised = true;
                if (this.detached) {
                    this._jsPlumb.div.parentNode.removeChild(this._jsPlumb.div);
                }
            }
            this._jsPlumb.div.style.left = (p.component.x + p.d.minx) + "px";
            this._jsPlumb.div.style.top = (p.component.y + p.d.miny) + "px";
        }
    });

    /*
     * Class: Overlays.Custom
     * A Custom overlay. You supply a 'create' function which returns some DOM element, and jsPlumb positions it.
     * The 'create' function is passed a Connection or Endpoint.
     */
    /*
     * Function: Constructor
     * 
     * Parameters:
     * create - function for jsPlumb to call that returns a DOM element.
     * location - distance (as a decimal from 0 to 1 inclusive) marking where the label should sit on the connector. defaults to 0.5.
     * id - optional id to use for later retrieval of this overlay.
     *
     */
    _jp.Overlays.Custom = function (params) {
        this.type = "Custom";
        AbstractDOMOverlay.apply(this, arguments);
    };
    _ju.extend(_jp.Overlays.Custom, AbstractDOMOverlay);

    _jp.Overlays.GuideLines = function () {
        var self = this;
        self.length = 50;
        self.strokeWidth = 5;
        this.type = "GuideLines";
        AbstractOverlay.apply(this, arguments);
        _jp.jsPlumbUIComponent.apply(this, arguments);
        this.draw = function (connector, currentConnectionPaintStyle) {

            var head = connector.pointAlongPathFrom(self.loc, self.length / 2),
                mid = connector.pointOnPath(self.loc),
                tail = _jg.pointOnLine(head, mid, self.length),
                tailLine = _jg.perpendicularLineTo(head, tail, 40),
                headLine = _jg.perpendicularLineTo(tail, head, 20);

            return {
                connector: connector,
                head: head,
                tail: tail,
                headLine: headLine,
                tailLine: tailLine,
                minX: Math.min(head.x, tail.x, headLine[0].x, headLine[1].x),
                minY: Math.min(head.y, tail.y, headLine[0].y, headLine[1].y),
                maxX: Math.max(head.x, tail.x, headLine[0].x, headLine[1].x),
                maxY: Math.max(head.y, tail.y, headLine[0].y, headLine[1].y)
            };
        };

        // this.cleanup = function() { };  // nothing to clean up for GuideLines
    };

    /*
     * Class: Overlays.Label

     */
    /*
     * Function: Constructor
     * 
     * Parameters:
     * cssClass - optional css class string to append to css class. This string is appended "as-is", so you can of course have multiple classes
     *             defined.  This parameter is preferred to using labelStyle, borderWidth and borderStyle.
     * label - the label to paint.  May be a string or a function that returns a string.  Nothing will be painted if your label is null or your
     *         label function returns null.  empty strings _will_ be painted.
     * location - distance (as a decimal from 0 to 1 inclusive) marking where the label should sit on the connector. defaults to 0.5.
     * id - optional id to use for later retrieval of this overlay.
     * 
     *
     */
    _jp.Overlays.Label = function (params) {
        this.labelStyle = params.labelStyle;

        var labelWidth = null, labelHeight = null, labelText = null, labelPadding = null;
        this.cssClass = this.labelStyle != null ? this.labelStyle.cssClass : null;
        var p = _jp.extend({
            create: function () {
                return _jp.createElement("div");
            }}, params);
        _jp.Overlays.Custom.call(this, p);
        this.type = "Label";
        this.label = params.label || "";
        this.labelText = null;
        if (this.labelStyle) {
            var el = this.getElement();
            this.labelStyle.font = this.labelStyle.font || "12px sans-serif";
            el.style.font = this.labelStyle.font;
            el.style.color = this.labelStyle.color || "black";
            if (this.labelStyle.fill) {
                el.style.background = this.labelStyle.fill;
            }
            if (this.labelStyle.borderWidth > 0) {
                var dStyle = this.labelStyle.borderStyle ? this.labelStyle.borderStyle : "black";
                el.style.border = this.labelStyle.borderWidth + "px solid " + dStyle;
            }
            if (this.labelStyle.padding) {
                el.style.padding = this.labelStyle.padding;
            }
        }

    };
    _ju.extend(_jp.Overlays.Label, _jp.Overlays.Custom, {
        cleanup: function (force) {
            if (force) {
                this.div = null;
                this.label = null;
                this.labelText = null;
                this.cssClass = null;
                this.labelStyle = null;
            }
        },
        getLabel: function () {
            return this.label;
        },
        /*
         * Function: setLabel
         * sets the label's, um, label.  you would think i'd call this function
         * 'setText', but you can pass either a Function or a String to this, so
         * it makes more sense as 'setLabel'. This uses innerHTML on the label div, so keep
         * that in mind if you need escaped HTML.
         */
        setLabel: function (l) {
            this.label = l;
            this.labelText = null;
            this.clearCachedDimensions();
            this.update();
            this.component.repaint();
        },
        getDimensions: function () {
            this.update();
            return AbstractDOMOverlay.prototype.getDimensions.apply(this, arguments);
        },
        update: function () {
            if (typeof this.label === "function") {
                var lt = this.label(this);
                this.getElement().innerHTML = lt.replace(/\r\n/g, "<br/>");
            }
            else {
                if (this.labelText == null) {
                    this.labelText = this.label;
                    this.getElement().innerHTML = this.labelText.replace(/\r\n/g, "<br/>");
                }
            }
        },
        updateFrom:function(d) {
            if(d.label != null){
                this.setLabel(d.label);
            }
        }
    });

    // ********************************* END OF OVERLAY DEFINITIONS ***********************************************************************

}).call(typeof window !== 'undefined' ? window : this);

/*
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;(function() {
    "use strict";

    var root = this,
        _ju = root.jsPlumbUtil,
        _jpi = root.jsPlumbInstance;

    var GROUP_COLLAPSED_CLASS = "jtk-group-collapsed";
    var GROUP_EXPANDED_CLASS = "jtk-group-expanded";
    var GROUP_CONTAINER_SELECTOR = "[jtk-group-content]";
    var ELEMENT_DRAGGABLE_EVENT = "elementDraggable";
    var STOP = "stop";
    var REVERT = "revert";
    var GROUP_MANAGER = "_groupManager";
    var GROUP = "_jsPlumbGroup";
    var GROUP_DRAG_SCOPE = "_jsPlumbGroupDrag";
    var EVT_CHILD_ADDED = "group:addMember";
    var EVT_CHILD_REMOVED = "group:removeMember";
    var EVT_GROUP_ADDED = "group:add";
    var EVT_GROUP_REMOVED = "group:remove";
    var EVT_EXPAND = "group:expand";
    var EVT_COLLAPSE = "group:collapse";
    var EVT_GROUP_DRAG_STOP = "groupDragStop";
    var EVT_CONNECTION_MOVED = "connectionMoved";
    var EVT_INTERNAL_CONNECTION_DETACHED = "internal.connectionDetached";

    var CMD_REMOVE_ALL = "removeAll";
    var CMD_ORPHAN_ALL = "orphanAll";
    var CMD_SHOW = "show";
    var CMD_HIDE = "hide";

    var GroupManager = function(_jsPlumb) {
        var _managedGroups = {}, _connectionSourceMap = {}, _connectionTargetMap = {}, self = this;

        _jsPlumb.bind("connection", function(p) {
            if (p.source[GROUP] != null && p.target[GROUP] != null && p.source[GROUP] === p.target[GROUP]) {
                _connectionSourceMap[p.connection.id] = p.source[GROUP];
                _connectionTargetMap[p.connection.id] = p.source[GROUP];
            }
            else {
                if (p.source[GROUP] != null) {
                    _ju.suggest(p.source[GROUP].connections.source, p.connection);
                    _connectionSourceMap[p.connection.id] = p.source[GROUP];
                }
                if (p.target[GROUP] != null) {
                    _ju.suggest(p.target[GROUP].connections.target, p.connection);
                    _connectionTargetMap[p.connection.id] = p.target[GROUP];
                }
            }
        });

        function _cleanupDetachedConnection(conn) {
            delete conn.proxies;
            var group = _connectionSourceMap[conn.id], f;
            if (group != null) {
                f = function(c) { return c.id === conn.id; };
                _ju.removeWithFunction(group.connections.source, f);
                _ju.removeWithFunction(group.connections.target, f);
                delete _connectionSourceMap[conn.id];
            }

            group = _connectionTargetMap[conn.id];
            if (group != null) {
                f = function(c) { return c.id === conn.id; };
                _ju.removeWithFunction(group.connections.source, f);
                _ju.removeWithFunction(group.connections.target, f);
                delete _connectionTargetMap[conn.id];
            }
        }

        _jsPlumb.bind(EVT_INTERNAL_CONNECTION_DETACHED, function(p) {
            _cleanupDetachedConnection(p.connection);
        });

        _jsPlumb.bind(EVT_CONNECTION_MOVED, function(p) {
            var connMap = p.index === 0 ? _connectionSourceMap : _connectionTargetMap;
            var group = connMap[p.connection.id];
            if (group) {
                var list = group.connections[p.index === 0 ? "source" : "target"];
                var idx = list.indexOf(p.connection);
                if (idx !== -1) {
                    list.splice(idx, 1);
                }
            }
        });

        this.addGroup = function(group) {
            _jsPlumb.addClass(group.getEl(), GROUP_EXPANDED_CLASS);
            _managedGroups[group.id] = group;
            group.manager = this;
            _updateConnectionsForGroup(group);
            _jsPlumb.fire(EVT_GROUP_ADDED, { group:group });
        };

        this.addToGroup = function(group, el, doNotFireEvent) {
            group = this.getGroup(group);
            if (group) {
                var groupEl = group.getEl();

                if (el._isJsPlumbGroup) {
                    return;
                }
                var currentGroup = el._jsPlumbGroup;
                // if already a member of this group, do nothing
                if (currentGroup !== group) {
                    var elpos = _jsPlumb.getOffset(el, true);
                    var cpos = group.collapsed ? _jsPlumb.getOffset(groupEl, true) : _jsPlumb.getOffset(group.getDragArea(), true);

                    // otherwise, transfer to this group.
                    if (currentGroup != null) {
                        currentGroup.remove(el, false, doNotFireEvent, false, group);
                        self.updateConnectionsForGroup(currentGroup);
                    }
                    group.add(el, doNotFireEvent/*, currentGroup*/);

                    var handleDroppedConnections = function (list, index) {
                        var oidx = index === 0 ? 1 : 0;
                        list.each(function (c) {
                            c.setVisible(false);
                            if (c.endpoints[oidx].element._jsPlumbGroup === group) {
                                c.endpoints[oidx].setVisible(false);
                                self.expandConnection(c, oidx, group);
                            }
                            else {
                                c.endpoints[index].setVisible(false);
                                self.collapseConnection(c, index, group);
                            }
                        });
                    };

                    if (group.collapsed) {
                        handleDroppedConnections(_jsPlumb.select({source: el}), 0);
                        handleDroppedConnections(_jsPlumb.select({target: el}), 1);
                    }

                    var elId = _jsPlumb.getId(el);
                    _jsPlumb.dragManager.setParent(el, elId, groupEl, _jsPlumb.getId(groupEl), elpos);

                    var newPosition = { left: elpos.left - cpos.left, top: elpos.top - cpos.top };

                    _jsPlumb.setPosition(el, newPosition);

                    _jsPlumb.dragManager.revalidateParent(el, elId, elpos);

                    self.updateConnectionsForGroup(group);

                    _jsPlumb.revalidate(elId);

                    if (!doNotFireEvent) {
                        var p = {group: group, el: el, pos:newPosition};
                        if (currentGroup) {
                            p.sourceGroup = currentGroup;
                        }
                        _jsPlumb.fire(EVT_CHILD_ADDED, p);
                    }
                }
            }
        };

        this.removeFromGroup = function(group, el, doNotFireEvent) {
            group = this.getGroup(group);
            if (group) {
                group.remove(el, null, doNotFireEvent);
            }
        };

        this.getGroup = function(groupId) {
            var group = groupId;
            if (_ju.isString(groupId)) {
                group = _managedGroups[groupId];
                if (group == null) {
                    throw new TypeError("No such group [" + groupId + "]");
                }
            }
            return group;
        };

        this.getGroups = function() {
            var o = [];
            for (var g in _managedGroups) {
                o.push(_managedGroups[g]);
            }
            return o;
        };

        this.removeGroup = function(group, deleteMembers, manipulateDOM, doNotFireEvent) {
            group = this.getGroup(group);
            this.expandGroup(group, true); // this reinstates any original connections and removes all proxies, but does not fire an event.
            var newPositions = group[deleteMembers ? CMD_REMOVE_ALL : CMD_ORPHAN_ALL](manipulateDOM, doNotFireEvent);
            _jsPlumb.remove(group.getEl());
            delete _managedGroups[group.id];
            delete _jsPlumb._groups[group.id];
            _jsPlumb.fire(EVT_GROUP_REMOVED, { group:group });
            return newPositions; // this will be null in the case or remove, but be a map of {id->[x,y]} in the case of orphan
        };

        this.removeAllGroups = function(deleteMembers, manipulateDOM, doNotFireEvent) {
            for (var g in _managedGroups) {
                this.removeGroup(_managedGroups[g], deleteMembers, manipulateDOM, doNotFireEvent);
            }
        };

        function _setVisible(group, state) {
            var m = group.getMembers();
            for (var i = 0; i < m.length; i++) {
                _jsPlumb[state ? CMD_SHOW : CMD_HIDE](m[i], true);
            }
        }

        var _collapseConnection = this.collapseConnection = function(c, index, group) {

            var proxyEp, groupEl = group.getEl(), groupElId = _jsPlumb.getId(groupEl),
                originalElementId = c.endpoints[index].elementId;

            var otherEl = c.endpoints[index === 0 ? 1 : 0].element;
            if (otherEl[GROUP] && (!otherEl[GROUP].shouldProxy() && otherEl[GROUP].collapsed)) {
                return;
            }

            c.proxies = c.proxies || [];
            if(c.proxies[index]) {
                proxyEp = c.proxies[index].ep;
            }else {
                proxyEp = _jsPlumb.addEndpoint(groupEl, {
                    endpoint:group.getEndpoint(c, index),
                    anchor:group.getAnchor(c, index),
                    parameters:{
                        isProxyEndpoint:true
                    }
                });
            }
            proxyEp.setDeleteOnEmpty(true);

            // for this index, stash proxy info: the new EP, the original EP.
            c.proxies[index] = { ep:proxyEp, originalEp: c.endpoints[index] };

            // and advise the anchor manager
            if (index === 0) {
                // TODO why are there two differently named methods? Why is there not one method that says "some end of this
                // connection changed (you give the index), and here's the new element and element id."
                _jsPlumb.anchorManager.sourceChanged(originalElementId, groupElId, c, groupEl);
            }
            else {
                _jsPlumb.anchorManager.updateOtherEndpoint(c.endpoints[0].elementId, originalElementId, groupElId, c);
                c.target = groupEl;
                c.targetId = groupElId;
            }


            // detach the original EP from the connection.
            c.proxies[index].originalEp.detachFromConnection(c, null, true);

            // set the proxy as the new ep
            proxyEp.connections = [ c ];
            c.endpoints[index] = proxyEp;

            c.setVisible(true);
        };

        this.collapseGroup = function(group) {
            group = this.getGroup(group);
            if (group == null || group.collapsed) {
                return;
            }
            var groupEl = group.getEl();

            // todo remove old proxy endpoints first, just in case?
            //group.proxies.length = 0;

            // hide all connections
            _setVisible(group, false);

            if (group.shouldProxy()) {
                // collapses all connections in a group.
                var _collapseSet = function (conns, index) {
                    for (var i = 0; i < conns.length; i++) {
                        var c = conns[i];
                        _collapseConnection(c, index, group);
                    }
                };

                // setup proxies for sources and targets
                _collapseSet(group.connections.source, 0);
                _collapseSet(group.connections.target, 1);
            }

            group.collapsed = true;
            _jsPlumb.removeClass(groupEl, GROUP_EXPANDED_CLASS);
            _jsPlumb.addClass(groupEl, GROUP_COLLAPSED_CLASS);
            _jsPlumb.revalidate(groupEl);
            _jsPlumb.fire(EVT_COLLAPSE, { group:group  });
        };

        var _expandConnection = this.expandConnection = function(c, index, group) {

            // if no proxies or none for this end of the connection, abort.
            if (c.proxies == null || c.proxies[index] == null) {
                return;
            }

            var groupElId = _jsPlumb.getId(group.getEl()),
                originalElement = c.proxies[index].originalEp.element,
                originalElementId = c.proxies[index].originalEp.elementId;

            c.endpoints[index] = c.proxies[index].originalEp;
            // and advise the anchor manager
            if (index === 0) {
                // TODO why are there two differently named methods? Why is there not one method that says "some end of this
                // connection changed (you give the index), and here's the new element and element id."
                _jsPlumb.anchorManager.sourceChanged(groupElId, originalElementId, c, originalElement);
            }
            else {
                _jsPlumb.anchorManager.updateOtherEndpoint(c.endpoints[0].elementId, groupElId, originalElementId, c);
                c.target = originalElement;
                c.targetId = originalElementId;
            }

            // detach the proxy EP from the connection (which will cause it to be removed as we no longer need it)
            c.proxies[index].ep.detachFromConnection(c, null);

            c.proxies[index].originalEp.addConnection(c);

            // cleanup
            delete c.proxies[index];
        };

        this.expandGroup = function(group, doNotFireEvent) {

            group = this.getGroup(group);

            if (group == null || !group.collapsed) {
                return;
            }
            var groupEl = group.getEl();

            _setVisible(group, true);

            if (group.shouldProxy()) {
                // collapses all connections in a group.
                var _expandSet = function (conns, index) {
                    for (var i = 0; i < conns.length; i++) {
                        var c = conns[i];
                        _expandConnection(c, index, group);
                    }
                };

                // setup proxies for sources and targets
                _expandSet(group.connections.source, 0);
                _expandSet(group.connections.target, 1);
            }

            group.collapsed = false;
            _jsPlumb.addClass(groupEl, GROUP_EXPANDED_CLASS);
            _jsPlumb.removeClass(groupEl, GROUP_COLLAPSED_CLASS);
            _jsPlumb.revalidate(groupEl);
            this.repaintGroup(group);
            if (!doNotFireEvent) {
                _jsPlumb.fire(EVT_EXPAND, { group: group});
            }
        };

        this.repaintGroup = function(group) {
            group = this.getGroup(group);
            var m = group.getMembers();
            for (var i = 0; i < m.length; i++) {
                _jsPlumb.revalidate(m[i]);
            }
        };

        // TODO refactor this with the code that responds to `connection` events.
        function _updateConnectionsForGroup(group) {
            var members = group.getMembers();
            var c1 = _jsPlumb.getConnections({source:members, scope:"*"}, true);
            var c2 = _jsPlumb.getConnections({target:members, scope:"*"}, true);
            var processed = {};
            group.connections.source.length = 0;
            group.connections.target.length = 0;
            var oneSet = function(c) {
                for (var i = 0; i < c.length; i++) {
                    if (processed[c[i].id]) {
                        continue;
                    }
                    processed[c[i].id] = true;
                    if (c[i].source._jsPlumbGroup === group) {
                        if (c[i].target._jsPlumbGroup !== group) {
                            group.connections.source.push(c[i]);
                        }
                        _connectionSourceMap[c[i].id] = group;
                    }
                    else if (c[i].target._jsPlumbGroup === group) {
                        group.connections.target.push(c[i]);
                        _connectionTargetMap[c[i].id] = group;
                    }
                }
            };
            oneSet(c1); oneSet(c2);
        }

        this.updateConnectionsForGroup = _updateConnectionsForGroup;
        this.refreshAllGroups = function() {
            for (var g in _managedGroups) {
                _updateConnectionsForGroup(_managedGroups[g]);
                _jsPlumb.dragManager.updateOffsets(_jsPlumb.getId(_managedGroups[g].getEl()));
            }
        };
    };

    /**
     *
     * @param {jsPlumbInstance} _jsPlumb Associated jsPlumb instance.
     * @param {Object} params
     * @param {Element} params.el The DOM element representing the Group.
     * @param {String} [params.id] Optional ID for the Group. A UUID will be assigned as the Group's ID if you do not provide one.
     * @param {Boolean} [params.constrain=false] If true, child elements will not be able to be dragged outside of the Group container.
     * @param {Boolean} [params.revert=true] By default, child elements revert to the container if dragged outside. You can change this by setting `revert:false`. This behaviour is also overridden if you set `orphan` or `prune`.
     * @param {Boolean} [params.orphan=false] If true, child elements dropped outside of the Group container will be removed from the Group (but not from the DOM).
     * @param {Boolean} [params.prune=false] If true, child elements dropped outside of the Group container will be removed from the Group and also from the DOM.
     * @param {Boolean} [params.dropOverride=false] If true, a child element that has been dropped onto some other Group will not be subject to the controls imposed by `prune`, `revert` or `orphan`.
     * @constructor
     */
    var Group = function(_jsPlumb, params) {
        var self = this;
        var el = params.el;
        this.getEl = function() { return el; };
        this.id = params.id || _ju.uuid();
        el._isJsPlumbGroup = true;

        var getDragArea = this.getDragArea = function() {
            var da = _jsPlumb.getSelector(el, GROUP_CONTAINER_SELECTOR);
            return da && da.length > 0 ? da[0] : el;
        };

        var ghost = params.ghost === true;
        var constrain = ghost || (params.constrain === true);
        var revert = params.revert !== false;
        var orphan = params.orphan === true;
        var prune = params.prune === true;
        var dropOverride = params.dropOverride === true;
        var proxied = params.proxied !== false;
        var elements = [];
        this.connections = { source:[], target:[], internal:[] };

        // this function, and getEndpoint below, are stubs for a future setup in which we can choose endpoint
        // and anchor based upon the connection and the index (source/target) of the endpoint to be proxied.
        this.getAnchor = function(conn, endpointIndex) {
            return params.anchor || "Continuous";
        };

        this.getEndpoint = function(conn, endpointIndex) {
            return params.endpoint || [ "Dot", { radius:10 }];
        };

        this.collapsed = false;
        if (params.draggable !== false) {
            var opts = {
                stop:function(params) {
                    _jsPlumb.fire(EVT_GROUP_DRAG_STOP, jsPlumb.extend(params, {group:self}));
                },
                scope:GROUP_DRAG_SCOPE
            };
            if (params.dragOptions) {
                root.jsPlumb.extend(opts, params.dragOptions);
            }
            _jsPlumb.draggable(params.el, opts);
        }
        if (params.droppable !== false) {
            _jsPlumb.droppable(params.el, {
                drop:function(p) {
                    var el = p.drag.el;
                    if (el._isJsPlumbGroup) {
                        return;
                    }
                    var currentGroup = el._jsPlumbGroup;
                    if (currentGroup !== self) {
                        if (currentGroup != null) {
                            if (currentGroup.overrideDrop(el, self)) {
                                return;
                            }
                        }
                        _jsPlumb.getGroupManager().addToGroup(self, el, false);
                    }

                }
            });
        }
        var _each = function(_el, fn) {
            var els = _el.nodeType == null ?  _el : [ _el ];
            for (var i = 0; i < els.length; i++) {
                fn(els[i]);
            }
        };

        this.overrideDrop = function(_el, targetGroup) {
            return dropOverride && (revert || prune || orphan);
        };

        this.add = function(_el, doNotFireEvent/*, sourceGroup*/) {
            var dragArea = getDragArea();
            _each(_el, function(__el) {

                if (__el._jsPlumbGroup != null) {
                    if (__el._jsPlumbGroup === self) {
                        return;
                    } else {
                        __el._jsPlumbGroup.remove(__el, true, doNotFireEvent, false);
                    }
                }

                __el._jsPlumbGroup = self;
                elements.push(__el);
                // test if draggable and add handlers if so.
                if (_jsPlumb.isAlreadyDraggable(__el)) {
                    _bindDragHandlers(__el);
                }

                if (__el.parentNode !== dragArea) {
                    dragArea.appendChild(__el);
                }

                // if (!doNotFireEvent) {
                //     var p = {group: self, el: __el};
                //     if (sourceGroup) {
                //         p.sourceGroup = sourceGroup;
                //     }
                //     //_jsPlumb.fire(EVT_CHILD_ADDED, p);
                // }
            });

            _jsPlumb.getGroupManager().updateConnectionsForGroup(self);
        };

        this.remove = function(el, manipulateDOM, doNotFireEvent, doNotUpdateConnections, targetGroup) {

            _each(el, function(__el) {
                delete __el._jsPlumbGroup;
                _ju.removeWithFunction(elements, function(e) {
                    return e === __el;
                });

                if (manipulateDOM) {
                    try { self.getDragArea().removeChild(__el); }
                    catch (e) {
                        jsPlumbUtil.log("Could not remove element from Group " + e);
                    }
                }
                _unbindDragHandlers(__el);
                if (!doNotFireEvent) {
                    var p = {group: self, el: __el};
                    if (targetGroup) {
                        p.targetGroup = targetGroup;
                    }
                    _jsPlumb.fire(EVT_CHILD_REMOVED, p);
                }
            });
            if (!doNotUpdateConnections) {
                _jsPlumb.getGroupManager().updateConnectionsForGroup(self);
            }
        };
        this.removeAll = function(manipulateDOM, doNotFireEvent) {
            for (var i = 0, l = elements.length; i < l; i++) {
                var el = elements[0];
                self.remove(el, manipulateDOM, doNotFireEvent, true);
                _jsPlumb.remove(el, true);
            }
            elements.length = 0;
            _jsPlumb.getGroupManager().updateConnectionsForGroup(self);
        };
        this.orphanAll = function() {
            var orphanedPositions = {};
            for (var i = 0; i < elements.length; i++) {
                var newPosition = _orphan(elements[i]);
                orphanedPositions[newPosition[0]] = newPosition[1];
            }
            elements.length = 0;

            return orphanedPositions;
        };
        this.getMembers = function() { return elements; };

        el[GROUP] = this;

        _jsPlumb.bind(ELEMENT_DRAGGABLE_EVENT, function(dragParams) {
            // if its for the current group,
            if (dragParams.el._jsPlumbGroup === this) {
                _bindDragHandlers(dragParams.el);
            }
        }.bind(this));

        function _findParent(_el) {
            return _el.offsetParent;
        }

        function _isInsideParent(_el, pos) {
            var p = _findParent(_el),
                s = _jsPlumb.getSize(p),
                ss = _jsPlumb.getSize(_el),
                leftEdge = pos[0],
                rightEdge = leftEdge + ss[0],
                topEdge = pos[1],
                bottomEdge = topEdge + ss[1];

            return rightEdge > 0 && leftEdge < s[0] && bottomEdge > 0 && topEdge < s[1];
        }

        //
        // orphaning an element means taking it out of the group and adding it to the main jsplumb container.
        // we return the new calculated position from this method and the element's id.
        //
        function _orphan(_el) {
            var id = _jsPlumb.getId(_el);
            var pos = _jsPlumb.getOffset(_el);
            _el.parentNode.removeChild(_el);
            _jsPlumb.getContainer().appendChild(_el);
            _jsPlumb.setPosition(_el, pos);
            delete _el._jsPlumbGroup;
            _unbindDragHandlers(_el);
            _jsPlumb.dragManager.clearParent(_el, id);
            return [id, pos];
        }

        //
        // remove an element from the group, then either prune it from the jsplumb instance, or just orphan it.
        //
        function _pruneOrOrphan(p) {
            var orphanedPosition = null;
            if (!_isInsideParent(p.el, p.pos)) {
                var group = p.el._jsPlumbGroup;
                if (prune) {
                    _jsPlumb.remove(p.el);
                } else {
                    orphanedPosition = _orphan(p.el);
                }

                group.remove(p.el);
            }

            return orphanedPosition;
        }

        //
        // redraws the element
        //
        function _revalidate(_el) {
            var id = _jsPlumb.getId(_el);
            _jsPlumb.revalidate(_el);
            _jsPlumb.dragManager.revalidateParent(_el, id);
        }

        //
        // unbind the group specific drag/revert handlers.
        //
        function _unbindDragHandlers(_el) {
            if (!_el._katavorioDrag) {
                return;
            }
            if (prune || orphan) {
                _el._katavorioDrag.off(STOP, _pruneOrOrphan);
            }
            if (!prune && !orphan && revert) {
                _el._katavorioDrag.off(REVERT, _revalidate);
                _el._katavorioDrag.setRevert(null);
            }
        }

        function _bindDragHandlers(_el) {
            if (!_el._katavorioDrag) {
                return;
            }
            if (prune || orphan) {
                _el._katavorioDrag.on(STOP, _pruneOrOrphan);
            }

            if (constrain) {
                _el._katavorioDrag.setConstrain(true);
            }

            if (ghost) {
                _el._katavorioDrag.setUseGhostProxy(true);
            }

            if (!prune && !orphan && revert) {
                _el._katavorioDrag.on(REVERT, _revalidate);
                _el._katavorioDrag.setRevert(function(__el, pos) {
                    return !_isInsideParent(__el, pos);
                });
            }
        }

        this.shouldProxy = function() {
            return proxied;
        };

        _jsPlumb.getGroupManager().addGroup(this);
    };

    /**
     * Adds a group to the jsPlumb instance.
     * @method addGroup
     * @param {Object} params
     * @return {Group} The newly created Group.
     */
    _jpi.prototype.addGroup = function(params) {
        var j = this;
        j._groups = j._groups || {};
        if (j._groups[params.id] != null) {
            throw new TypeError("cannot create Group [" + params.id + "]; a Group with that ID exists");
        }
        if (params.el[GROUP] != null) {
            throw new TypeError("cannot create Group [" + params.id + "]; the given element is already a Group");
        }
        var group = new Group(j, params);
        j._groups[group.id] = group;
        if (params.collapsed) {
            this.collapseGroup(group);
        }
        return group;
    };

    /**
     * Add an element to a group.
     * @method addToGroup
     * @param {String} group Group, or ID of the group, to add the element to.
     * @param {Element} el Element to add to the group.
     */
    _jpi.prototype.addToGroup = function(group, el, doNotFireEvent) {

        var _one = function(_el) {
            var id = this.getId(_el);
            this.manage(id, _el);
            this.getGroupManager().addToGroup(group, _el, doNotFireEvent);
        }.bind(this);

        if (Array.isArray(el)) {
            for (var i = 0; i < el.length; i++) {
                _one(el[i]);
            }
        } else {
            _one(el);
        }
    };

    /**
     * Remove an element from a group.
     * @method removeFromGroup
     * @param {String} group Group, or ID of the group, to remove the element from.
     * @param {Element} el Element to add to the group.
     */
    _jpi.prototype.removeFromGroup = function(group, el, doNotFireEvent) {
        this.getGroupManager().removeFromGroup(group, el, doNotFireEvent);
    };

    /**
     * Remove a group, and optionally remove its members from the jsPlumb instance.
     * @method removeGroup
     * @param {String|Group} group Group to delete, or ID of Group to delete.
     * @param {Boolean} [deleteMembers=false] If true, group members will be removed along with the group. Otherwise they will
     * just be 'orphaned' (returned to the main container).
     * @returns {Map[String, Position}} When deleteMembers is false, this method returns a map of {id->position}
     */
    _jpi.prototype.removeGroup = function(group, deleteMembers, manipulateDOM, doNotFireEvent) {
        return this.getGroupManager().removeGroup(group, deleteMembers, manipulateDOM, doNotFireEvent);
    };

    /**
     * Remove all groups, and optionally remove their members from the jsPlumb instance.
     * @method removeAllGroup
     * @param {Boolean} [deleteMembers=false] If true, group members will be removed along with the groups. Otherwise they will
     * just be 'orphaned' (returned to the main container).
     */
    _jpi.prototype.removeAllGroups = function(deleteMembers, manipulateDOM, doNotFireEvent) {
        this.getGroupManager().removeAllGroups(deleteMembers, manipulateDOM, doNotFireEvent);
    };

    /**
     * Get a Group
     * @method getGroup
     * @param {String} groupId ID of the group to get
     * @return {Group} Group with the given ID, null if not found.
     */
    _jpi.prototype.getGroup = function(groupId) {
        return this.getGroupManager().getGroup(groupId);
    };

    /**
     * Gets all the Groups managed by the jsPlumb instance.
     * @returns {Group[]} List of Groups. Empty if none.
     */
    _jpi.prototype.getGroups = function() {
        return this.getGroupManager().getGroups();
    };

    /**
     * Expands a group element. jsPlumb doesn't do "everything" for you here, because what it means to expand a Group
     * will vary from application to application. jsPlumb does these things:
     *
     * - Hides any connections that are internal to the group (connections between members, and connections from member of
     * the group to the group itself)
     * - Proxies all connections for which the source or target is a member of the group.
     * - Hides the proxied connections.
     * - Adds the jtk-group-expanded class to the group's element
     * - Removes the jtk-group-collapsed class from the group's element.
     *
     * @method expandGroup
     * @param {String|Group} group Group to expand, or ID of Group to expand.
     */
    _jpi.prototype.expandGroup = function(group) {
        this.getGroupManager().expandGroup(group);
    };

    /**
     * Collapses a group element. jsPlumb doesn't do "everything" for you here, because what it means to collapse a Group
     * will vary from application to application. jsPlumb does these things:
     *
     * - Shows any connections that are internal to the group (connections between members, and connections from member of
     * the group to the group itself)
     * - Removes proxies for all connections for which the source or target is a member of the group.
     * - Shows the previously proxied connections.
     * - Adds the jtk-group-collapsed class to the group's element
     * - Removes the jtk-group-expanded class from the group's element.
     *
     * @method expandGroup
     * @param {String|Group} group Group to expand, or ID of Group to expand.
     */
    _jpi.prototype.collapseGroup = function(groupId) {
        this.getGroupManager().collapseGroup(groupId);
    };


    _jpi.prototype.repaintGroup = function(group) {
        this.getGroupManager().repaintGroup(group);
    };

    /**
     * Collapses or expands a group element depending on its current state. See notes in the collapseGroup and expandGroup method.
     *
     * @method toggleGroup
     * @param {String|Group} group Group to expand/collapse, or ID of Group to expand/collapse.
     */
    _jpi.prototype.toggleGroup = function(group) {
        group = this.getGroupManager().getGroup(group);
        if (group != null) {
            this.getGroupManager()[group.collapsed ? "expandGroup" : "collapseGroup"](group);
        }
    };

    //
    // lazy init a group manager for the given jsplumb instance.
    //
    _jpi.prototype.getGroupManager = function() {
        var mgr = this[GROUP_MANAGER];
        if (mgr == null) {
            mgr = this[GROUP_MANAGER] = new GroupManager(this);
        }
        return mgr;
    };

    _jpi.prototype.removeGroupManager = function() {
        delete this[GROUP_MANAGER];
    };

    /**
     * Gets the Group that the given element belongs to, null if none.
     * @method getGroupFor
     * @param {String|Element} el Element, or element ID.
     * @returns {Group} A Group, if found, or null.
     */
    _jpi.prototype.getGroupFor = function(el) {
        el = this.getElement(el);
        if (el) {
            return el[GROUP];
        }
    };

}).call(typeof window !== 'undefined' ? window : this);


/*
 * This file contains the 'flowchart' connectors, consisting of vertical and horizontal line segments.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;
(function () {

    "use strict";
    var root = this, _jp = root.jsPlumb, _ju = root.jsPlumbUtil;
    var STRAIGHT = "Straight";
    var ARC = "Arc";

    var Flowchart = function (params) {
        this.type = "Flowchart";
        params = params || {};
        params.stub = params.stub == null ? 30 : params.stub;
        var segments,
            _super = _jp.Connectors.AbstractConnector.apply(this, arguments),
            midpoint = params.midpoint == null ? 0.5 : params.midpoint,
            alwaysRespectStubs = params.alwaysRespectStubs === true,
            lastx = null, lasty = null, lastOrientation,
            cornerRadius = params.cornerRadius != null ? params.cornerRadius : 0,

            // TODO now common between this and AbstractBezierEditor; refactor into superclass?
            loopbackRadius = params.loopbackRadius || 25,
            isLoopbackCurrently = false,

            sgn = function (n) {
                return n < 0 ? -1 : n === 0 ? 0 : 1;
            },
            segmentDirections = function(segment) {
            return [
                    sgn( segment[2] - segment[0] ),
                    sgn( segment[3] - segment[1] )
                ];
            },
            /**
             * helper method to add a segment.
             */
            addSegment = function (segments, x, y, paintInfo) {
                if (lastx === x && lasty === y) {
                    return;
                }
                var lx = lastx == null ? paintInfo.sx : lastx,
                    ly = lasty == null ? paintInfo.sy : lasty,
                    o = lx === x ? "v" : "h";

                lastx = x;
                lasty = y;
                segments.push([ lx, ly, x, y, o ]);
            },
            segLength = function (s) {
                return Math.sqrt(Math.pow(s[0] - s[2], 2) + Math.pow(s[1] - s[3], 2));
            },
            _cloneArray = function (a) {
                var _a = [];
                _a.push.apply(_a, a);
                return _a;
            },
            writeSegments = function (conn, segments, paintInfo) {
                var current = null, next, currentDirection, nextDirection;
                for (var i = 0; i < segments.length - 1; i++) {

                    current = current || _cloneArray(segments[i]);
                    next = _cloneArray(segments[i + 1]);

                    currentDirection = segmentDirections(current);
                    nextDirection = segmentDirections(next);

                    if (cornerRadius > 0 && current[4] !== next[4]) {

                        var minSegLength = Math.min(segLength(current), segLength(next));
                        var radiusToUse = Math.min(cornerRadius, minSegLength / 2);

                        current[2] -= currentDirection[0] * radiusToUse;
                        current[3] -= currentDirection[1] * radiusToUse;
                        next[0] += nextDirection[0] * radiusToUse;
                        next[1] += nextDirection[1] * radiusToUse;

                        var ac = (currentDirection[1] === nextDirection[0] && nextDirection[0] === 1) ||
                                ((currentDirection[1] === nextDirection[0] && nextDirection[0] === 0) && currentDirection[0] !== nextDirection[1]) ||
                                (currentDirection[1] === nextDirection[0] && nextDirection[0] === -1),
                                sgny = next[1] > current[3] ? 1 : -1,
                                sgnx = next[0] > current[2] ? 1 : -1,
                                sgnEqual = sgny === sgnx,
                                cx = (sgnEqual && ac || (!sgnEqual && !ac)) ? next[0] : current[2],
                                cy = (sgnEqual && ac || (!sgnEqual && !ac)) ? current[3] : next[1];

                        _super.addSegment(conn, STRAIGHT, {
                            x1: current[0], y1: current[1], x2: current[2], y2: current[3]
                        });

                        _super.addSegment(conn, ARC, {
                            r: radiusToUse,
                            x1: current[2],
                            y1: current[3],
                            x2: next[0],
                            y2: next[1],
                            cx: cx,
                            cy: cy,
                            ac: ac
                        });
                    }
                    else {
                        // dx + dy are used to adjust for line width.
                        var dx = (current[2] === current[0]) ? 0 : (current[2] > current[0]) ? (paintInfo.lw / 2) : -(paintInfo.lw / 2),
                            dy = (current[3] === current[1]) ? 0 : (current[3] > current[1]) ? (paintInfo.lw / 2) : -(paintInfo.lw / 2);

                        _super.addSegment(conn, STRAIGHT, {
                            x1: current[0] - dx, y1: current[1] - dy, x2: current[2] + dx, y2: current[3] + dy
                        });
                    }
                    current = next;
                }
                if (next != null) {
                    // last segment
                    _super.addSegment(conn, STRAIGHT, {
                        x1: next[0], y1: next[1], x2: next[2], y2: next[3]
                    });
                }
            };

        this._compute = function (paintInfo, params) {

            segments = [];
            lastx = null;
            lasty = null;
            lastOrientation = null;

            var commonStubCalculator = function () {
                    return [paintInfo.startStubX, paintInfo.startStubY, paintInfo.endStubX, paintInfo.endStubY];
                },
                stubCalculators = {
                    perpendicular: commonStubCalculator,
                    orthogonal: commonStubCalculator,
                    opposite: function (axis) {
                        var pi = paintInfo,
                            idx = axis === "x" ? 0 : 1,
                            areInProximity = {
                                "x": function () {
                                    return ( (pi.so[idx] === 1 && (
                                        ( (pi.startStubX > pi.endStubX) && (pi.tx > pi.startStubX) ) ||
                                        ( (pi.sx > pi.endStubX) && (pi.tx > pi.sx))))) ||

                                        ( (pi.so[idx] === -1 && (
                                        ( (pi.startStubX < pi.endStubX) && (pi.tx < pi.startStubX) ) ||
                                        ( (pi.sx < pi.endStubX) && (pi.tx < pi.sx)))));
                                },
                                "y": function () {
                                    return ( (pi.so[idx] === 1 && (
                                        ( (pi.startStubY > pi.endStubY) && (pi.ty > pi.startStubY) ) ||
                                        ( (pi.sy > pi.endStubY) && (pi.ty > pi.sy))))) ||

                                        ( (pi.so[idx] === -1 && (
                                        ( (pi.startStubY < pi.endStubY) && (pi.ty < pi.startStubY) ) ||
                                        ( (pi.sy < pi.endStubY) && (pi.ty < pi.sy)))));
                                }
                            };

                        if (!alwaysRespectStubs && areInProximity[axis]()) {
                            return {
                                "x": [(paintInfo.sx + paintInfo.tx) / 2, paintInfo.startStubY, (paintInfo.sx + paintInfo.tx) / 2, paintInfo.endStubY],
                                "y": [paintInfo.startStubX, (paintInfo.sy + paintInfo.ty) / 2, paintInfo.endStubX, (paintInfo.sy + paintInfo.ty) / 2]
                            }[axis];
                        }
                        else {
                            return [paintInfo.startStubX, paintInfo.startStubY, paintInfo.endStubX, paintInfo.endStubY];
                        }
                    }
                };

            // calculate Stubs.
            var stubs = stubCalculators[paintInfo.anchorOrientation](paintInfo.sourceAxis),
                idx = paintInfo.sourceAxis === "x" ? 0 : 1,
                oidx = paintInfo.sourceAxis === "x" ? 1 : 0,
                ss = stubs[idx],
                oss = stubs[oidx],
                es = stubs[idx + 2],
                oes = stubs[oidx + 2];

            // add the start stub segment. use stubs for loopback as it will look better, with the loop spaced
            // away from the element.
            addSegment(segments, stubs[0], stubs[1], paintInfo);

            // if its a loopback and we should treat it differently.
            // if (false && params.sourcePos[0] === params.targetPos[0] && params.sourcePos[1] === params.targetPos[1]) {
            //
            //     // we use loopbackRadius here, as statemachine connectors do.
            //     // so we go radius to the left from stubs[0], then upwards by 2*radius, to the right by 2*radius,
            //     // down by 2*radius, left by radius.
            //     addSegment(segments, stubs[0] - loopbackRadius, stubs[1], paintInfo);
            //     addSegment(segments, stubs[0] - loopbackRadius, stubs[1] - (2 * loopbackRadius), paintInfo);
            //     addSegment(segments, stubs[0] + loopbackRadius, stubs[1] - (2 * loopbackRadius), paintInfo);
            //     addSegment(segments, stubs[0] + loopbackRadius, stubs[1], paintInfo);
            //     addSegment(segments, stubs[0], stubs[1], paintInfo);
            //
            // }
            // else {


                var midx = paintInfo.startStubX + ((paintInfo.endStubX - paintInfo.startStubX) * midpoint),
                    midy = paintInfo.startStubY + ((paintInfo.endStubY - paintInfo.startStubY) * midpoint);

                var orientations = {x: [0, 1], y: [1, 0]},
                    lineCalculators = {
                        perpendicular: function (axis) {
                            var pi = paintInfo,
                                sis = {
                                    x: [
                                        [[1, 2, 3, 4], null, [2, 1, 4, 3]],
                                        null,
                                        [[4, 3, 2, 1], null, [3, 4, 1, 2]]
                                    ],
                                    y: [
                                        [[3, 2, 1, 4], null, [2, 3, 4, 1]],
                                        null,
                                        [[4, 1, 2, 3], null, [1, 4, 3, 2]]
                                    ]
                                },
                                stubs = {
                                    x: [[pi.startStubX, pi.endStubX], null, [pi.endStubX, pi.startStubX]],
                                    y: [[pi.startStubY, pi.endStubY], null, [pi.endStubY, pi.startStubY]]
                                },
                                midLines = {
                                    x: [[midx, pi.startStubY], [midx, pi.endStubY]],
                                    y: [[pi.startStubX, midy], [pi.endStubX, midy]]
                                },
                                linesToEnd = {
                                    x: [[pi.endStubX, pi.startStubY]],
                                    y: [[pi.startStubX, pi.endStubY]]
                                },
                                startToEnd = {
                                    x: [[pi.startStubX, pi.endStubY], [pi.endStubX, pi.endStubY]],
                                    y: [[pi.endStubX, pi.startStubY], [pi.endStubX, pi.endStubY]]
                                },
                                startToMidToEnd = {
                                    x: [[pi.startStubX, midy], [pi.endStubX, midy], [pi.endStubX, pi.endStubY]],
                                    y: [[midx, pi.startStubY], [midx, pi.endStubY], [pi.endStubX, pi.endStubY]]
                                },
                                otherStubs = {
                                    x: [pi.startStubY, pi.endStubY],
                                    y: [pi.startStubX, pi.endStubX]
                                },
                                soIdx = orientations[axis][0], toIdx = orientations[axis][1],
                                _so = pi.so[soIdx] + 1,
                                _to = pi.to[toIdx] + 1,
                                otherFlipped = (pi.to[toIdx] === -1 && (otherStubs[axis][1] < otherStubs[axis][0])) || (pi.to[toIdx] === 1 && (otherStubs[axis][1] > otherStubs[axis][0])),
                                stub1 = stubs[axis][_so][0],
                                stub2 = stubs[axis][_so][1],
                                segmentIndexes = sis[axis][_so][_to];

                            if (pi.segment === segmentIndexes[3] || (pi.segment === segmentIndexes[2] && otherFlipped)) {
                                return midLines[axis];
                            }
                            else if (pi.segment === segmentIndexes[2] && stub2 < stub1) {
                                return linesToEnd[axis];
                            }
                            else if ((pi.segment === segmentIndexes[2] && stub2 >= stub1) || (pi.segment === segmentIndexes[1] && !otherFlipped)) {
                                return startToMidToEnd[axis];
                            }
                            else if (pi.segment === segmentIndexes[0] || (pi.segment === segmentIndexes[1] && otherFlipped)) {
                                return startToEnd[axis];
                            }
                        },
                        orthogonal: function (axis, startStub, otherStartStub, endStub, otherEndStub) {
                            var pi = paintInfo,
                                extent = {
                                    "x": pi.so[0] === -1 ? Math.min(startStub, endStub) : Math.max(startStub, endStub),
                                    "y": pi.so[1] === -1 ? Math.min(startStub, endStub) : Math.max(startStub, endStub)
                                }[axis];

                            return {
                                "x": [
                                    [extent, otherStartStub],
                                    [extent, otherEndStub],
                                    [endStub, otherEndStub]
                                ],
                                "y": [
                                    [otherStartStub, extent],
                                    [otherEndStub, extent],
                                    [otherEndStub, endStub]
                                ]
                            }[axis];
                        },
                        opposite: function (axis, ss, oss, es) {
                            var pi = paintInfo,
                                otherAxis = {"x": "y", "y": "x"}[axis],
                                dim = {"x": "height", "y": "width"}[axis],
                                comparator = pi["is" + axis.toUpperCase() + "GreaterThanStubTimes2"];

                            if (params.sourceEndpoint.elementId === params.targetEndpoint.elementId) {
                                var _val = oss + ((1 - params.sourceEndpoint.anchor[otherAxis]) * params.sourceInfo[dim]) + _super.maxStub;
                                return {
                                    "x": [
                                        [ss, _val],
                                        [es, _val]
                                    ],
                                    "y": [
                                        [_val, ss],
                                        [_val, es]
                                    ]
                                }[axis];

                            }
                            else if (!comparator || (pi.so[idx] === 1 && ss > es) || (pi.so[idx] === -1 && ss < es)) {
                                return {
                                    "x": [
                                        [ss, midy],
                                        [es, midy]
                                    ],
                                    "y": [
                                        [midx, ss],
                                        [midx, es]
                                    ]
                                }[axis];
                            }
                            else if ((pi.so[idx] === 1 && ss < es) || (pi.so[idx] === -1 && ss > es)) {
                                return {
                                    "x": [
                                        [midx, pi.sy],
                                        [midx, pi.ty]
                                    ],
                                    "y": [
                                        [pi.sx, midy],
                                        [pi.tx, midy]
                                    ]
                                }[axis];
                            }
                        }
                    };

                // compute the rest of the line
                var p = lineCalculators[paintInfo.anchorOrientation](paintInfo.sourceAxis, ss, oss, es, oes);
                if (p) {
                    for (var i = 0; i < p.length; i++) {
                        addSegment(segments, p[i][0], p[i][1], paintInfo);
                    }
                }

                // line to end stub
                addSegment(segments, stubs[2], stubs[3], paintInfo);

            //}

            // end stub to end (common)
            addSegment(segments, paintInfo.tx, paintInfo.ty, paintInfo);



            // write out the segments.
            writeSegments(this, segments, paintInfo);

        };
    };

    _jp.Connectors.Flowchart = Flowchart;
    _ju.extend(_jp.Connectors.Flowchart, _jp.Connectors.AbstractConnector);

}).call(typeof window !== 'undefined' ? window : this);
/*
 * This file contains the code for the Bezier connector type.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;
(function () {

    "use strict";
    var root = this, _jp = root.jsPlumb, _ju = root.jsPlumbUtil;

    _jp.Connectors.AbstractBezierConnector = function(params) {
        params = params || {};
        var showLoopback = params.showLoopback !== false,
            curviness = params.curviness || 10,
            margin = params.margin || 5,
            proximityLimit = params.proximityLimit || 80,
            clockwise = params.orientation && params.orientation === "clockwise",
            loopbackRadius = params.loopbackRadius || 25,
            isLoopbackCurrently = false,
            _super;

        this._compute = function (paintInfo, p) {

            var sp = p.sourcePos,
                tp = p.targetPos,
                _w = Math.abs(sp[0] - tp[0]),
                _h = Math.abs(sp[1] - tp[1]);

            if (!showLoopback || (p.sourceEndpoint.elementId !== p.targetEndpoint.elementId)) {
                isLoopbackCurrently = false;
                this._computeBezier(paintInfo, p, sp, tp, _w, _h);
            } else {
                isLoopbackCurrently = true;
                // a loopback connector.  draw an arc from one anchor to the other.
                var x1 = p.sourcePos[0], y1 = p.sourcePos[1] - margin,
                    cx = x1, cy = y1 - loopbackRadius,
                // canvas sizing stuff, to ensure the whole painted area is visible.
                    _x = cx - loopbackRadius,
                    _y = cy - loopbackRadius;

                _w = 2 * loopbackRadius;
                _h = 2 * loopbackRadius;

                paintInfo.points[0] = _x;
                paintInfo.points[1] = _y;
                paintInfo.points[2] = _w;
                paintInfo.points[3] = _h;

                // ADD AN ARC SEGMENT.
                _super.addSegment(this, "Arc", {
                    loopback: true,
                    x1: (x1 - _x) + 4,
                    y1: y1 - _y,
                    startAngle: 0,
                    endAngle: 2 * Math.PI,
                    r: loopbackRadius,
                    ac: !clockwise,
                    x2: (x1 - _x) - 4,
                    y2: y1 - _y,
                    cx: cx - _x,
                    cy: cy - _y
                });
            }
        };

        _super = _jp.Connectors.AbstractConnector.apply(this, arguments);
        return _super;
    };
    _ju.extend(_jp.Connectors.AbstractBezierConnector, _jp.Connectors.AbstractConnector);

    var Bezier = function (params) {
        params = params || {};
        this.type = "Bezier";

        var _super = _jp.Connectors.AbstractBezierConnector.apply(this, arguments),
            majorAnchor = params.curviness || 150,
            minorAnchor = 10;

        this.getCurviness = function () {
            return majorAnchor;
        };

        this._findControlPoint = function (point, sourceAnchorPosition, targetAnchorPosition, sourceEndpoint, targetEndpoint, soo, too) {
            // determine if the two anchors are perpendicular to each other in their orientation.  we swap the control
            // points around if so (code could be tightened up)
            var perpendicular = soo[0] !== too[0] || soo[1] === too[1],
                p = [];

            if (!perpendicular) {
                if (soo[0] === 0) {
                    p.push(sourceAnchorPosition[0] < targetAnchorPosition[0] ? point[0] + minorAnchor : point[0] - minorAnchor);
                }
                else {
                    p.push(point[0] - (majorAnchor * soo[0]));
                }

                if (soo[1] === 0) {
                    p.push(sourceAnchorPosition[1] < targetAnchorPosition[1] ? point[1] + minorAnchor : point[1] - minorAnchor);
                }
                else {
                    p.push(point[1] + (majorAnchor * too[1]));
                }
            }
            else {
                if (too[0] === 0) {
                    p.push(targetAnchorPosition[0] < sourceAnchorPosition[0] ? point[0] + minorAnchor : point[0] - minorAnchor);
                }
                else {
                    p.push(point[0] + (majorAnchor * too[0]));
                }

                if (too[1] === 0) {
                    p.push(targetAnchorPosition[1] < sourceAnchorPosition[1] ? point[1] + minorAnchor : point[1] - minorAnchor);
                }
                else {
                    p.push(point[1] + (majorAnchor * soo[1]));
                }
            }

            return p;
        };

        this._computeBezier = function (paintInfo, p, sp, tp, _w, _h) {

            var _CP, _CP2,
                _sx = sp[0] < tp[0] ? _w : 0,
                _sy = sp[1] < tp[1] ? _h : 0,
                _tx = sp[0] < tp[0] ? 0 : _w,
                _ty = sp[1] < tp[1] ? 0 : _h;

            _CP = this._findControlPoint([_sx, _sy], sp, tp, p.sourceEndpoint, p.targetEndpoint, paintInfo.so, paintInfo.to);
            _CP2 = this._findControlPoint([_tx, _ty], tp, sp, p.targetEndpoint, p.sourceEndpoint, paintInfo.to, paintInfo.so);


            _super.addSegment(this, "Bezier", {
                x1: _sx, y1: _sy, x2: _tx, y2: _ty,
                cp1x: _CP[0], cp1y: _CP[1], cp2x: _CP2[0], cp2y: _CP2[1]
            });
        };


    };

    _jp.Connectors.Bezier = Bezier;
    _ju.extend(Bezier, _jp.Connectors.AbstractBezierConnector);

}).call(typeof window !== 'undefined' ? window : this);
/*
 * This file contains the state machine connectors, which extend AbstractBezierConnector.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 * 
 * Dual licensed under the MIT and GPL2 licenses.
 */
;
(function () {

    "use strict";
    var root = this, _jp = root.jsPlumb, _ju = root.jsPlumbUtil;

    var _segment = function (x1, y1, x2, y2) {
            if (x1 <= x2 && y2 <= y1) {
                return 1;
            }
            else if (x1 <= x2 && y1 <= y2) {
                return 2;
            }
            else if (x2 <= x1 && y2 >= y1) {
                return 3;
            }
            return 4;
        },

    // the control point we will use depends on the faces to which each end of the connection is assigned, specifically whether or not the
    // two faces are parallel or perpendicular.  if they are parallel then the control point lies on the midpoint of the axis in which they
    // are parellel and varies only in the other axis; this variation is proportional to the distance that the anchor points lie from the
    // center of that face.  if the two faces are perpendicular then the control point is at some distance from both the midpoints; the amount and
    // direction are dependent on the orientation of the two elements. 'seg', passed in to this method, tells you which segment the target element
    // lies in with respect to the source: 1 is top right, 2 is bottom right, 3 is bottom left, 4 is top left.
    //
    // sourcePos and targetPos are arrays of info about where on the source and target each anchor is located.  their contents are:
    //
    // 0 - absolute x
    // 1 - absolute y
    // 2 - proportional x in element (0 is left edge, 1 is right edge)
    // 3 - proportional y in element (0 is top edge, 1 is bottom edge)
    //
        _findControlPoint = function (midx, midy, segment, sourceEdge, targetEdge, dx, dy, distance, proximityLimit) {
            // TODO (maybe)
            // - if anchor pos is 0.5, make the control point take into account the relative position of the elements.
            if (distance <= proximityLimit) {
                return [midx, midy];
            }

            if (segment === 1) {
                if (sourceEdge[3] <= 0 && targetEdge[3] >= 1) {
                    return [ midx + (sourceEdge[2] < 0.5 ? -1 * dx : dx), midy ];
                }
                else if (sourceEdge[2] >= 1 && targetEdge[2] <= 0) {
                    return [ midx, midy + (sourceEdge[3] < 0.5 ? -1 * dy : dy) ];
                }
                else {
                    return [ midx + (-1 * dx) , midy + (-1 * dy) ];
                }
            }
            else if (segment === 2) {
                if (sourceEdge[3] >= 1 && targetEdge[3] <= 0) {
                    return [ midx + (sourceEdge[2] < 0.5 ? -1 * dx : dx), midy ];
                }
                else if (sourceEdge[2] >= 1 && targetEdge[2] <= 0) {
                    return [ midx, midy + (sourceEdge[3] < 0.5 ? -1 * dy : dy) ];
                }
                else {
                    return [ midx + dx, midy + (-1 * dy) ];
                }
            }
            else if (segment === 3) {
                if (sourceEdge[3] >= 1 && targetEdge[3] <= 0) {
                    return [ midx + (sourceEdge[2] < 0.5 ? -1 * dx : dx), midy ];
                }
                else if (sourceEdge[2] <= 0 && targetEdge[2] >= 1) {
                    return [ midx, midy + (sourceEdge[3] < 0.5 ? -1 * dy : dy) ];
                }
                else {
                    return [ midx + (-1 * dx) , midy + (-1 * dy) ];
                }
            }
            else if (segment === 4) {
                if (sourceEdge[3] <= 0 && targetEdge[3] >= 1) {
                    return [ midx + (sourceEdge[2] < 0.5 ? -1 * dx : dx), midy ];
                }
                else if (sourceEdge[2] <= 0 && targetEdge[2] >= 1) {
                    return [ midx, midy + (sourceEdge[3] < 0.5 ? -1 * dy : dy) ];
                }
                else {
                    return [ midx + dx , midy + (-1 * dy) ];
                }
            }

        };

    var StateMachine = function (params) {
        params = params || {};
        this.type = "StateMachine";

        var _super = _jp.Connectors.AbstractBezierConnector.apply(this, arguments),
            curviness = params.curviness || 10,
            margin = params.margin || 5,
            proximityLimit = params.proximityLimit || 80,
            clockwise = params.orientation && params.orientation === "clockwise",
            _controlPoint;

        this._computeBezier = function(paintInfo, params, sp, tp, w, h) {
            var _sx = params.sourcePos[0] < params.targetPos[0] ? 0 : w,
                _sy = params.sourcePos[1] < params.targetPos[1] ? 0 : h,
                _tx = params.sourcePos[0] < params.targetPos[0] ? w : 0,
                _ty = params.sourcePos[1] < params.targetPos[1] ? h : 0;

            // now adjust for the margin
            if (params.sourcePos[2] === 0) {
                _sx -= margin;
            }
            if (params.sourcePos[2] === 1) {
                _sx += margin;
            }
            if (params.sourcePos[3] === 0) {
                _sy -= margin;
            }
            if (params.sourcePos[3] === 1) {
                _sy += margin;
            }
            if (params.targetPos[2] === 0) {
                _tx -= margin;
            }
            if (params.targetPos[2] === 1) {
                _tx += margin;
            }
            if (params.targetPos[3] === 0) {
                _ty -= margin;
            }
            if (params.targetPos[3] === 1) {
                _ty += margin;
            }

            //
            // these connectors are quadratic bezier curves, having a single control point. if both anchors
            // are located at 0.5 on their respective faces, the control point is set to the midpoint and you
            // get a straight line.  this is also the case if the two anchors are within 'proximityLimit', since
            // it seems to make good aesthetic sense to do that. outside of that, the control point is positioned
            // at 'curviness' pixels away along the normal to the straight line connecting the two anchors.
            //
            // there may be two improvements to this.  firstly, we might actually support the notion of avoiding nodes
            // in the UI, or at least making a good effort at doing so.  if a connection would pass underneath some node,
            // for example, we might increase the distance the control point is away from the midpoint in a bid to
            // steer it around that node.  this will work within limits, but i think those limits would also be the likely
            // limits for, once again, aesthetic good sense in the layout of a chart using these connectors.
            //
            // the second possible change is actually two possible changes: firstly, it is possible we should gradually
            // decrease the 'curviness' as the distance between the anchors decreases; start tailing it off to 0 at some
            // point (which should be configurable).  secondly, we might slightly increase the 'curviness' for connectors
            // with respect to how far their anchor is from the center of its respective face. this could either look cool,
            // or stupid, and may indeed work only in a way that is so subtle as to have been a waste of time.
            //

            var _midx = (_sx + _tx) / 2,
                _midy = (_sy + _ty) / 2,
                segment = _segment(_sx, _sy, _tx, _ty),
                distance = Math.sqrt(Math.pow(_tx - _sx, 2) + Math.pow(_ty - _sy, 2)),
                cp1x, cp2x, cp1y, cp2y;


            // calculate the control point.  this code will be where we'll put in a rudimentary element avoidance scheme; it
            // will work by extending the control point to force the curve to be, um, curvier.
            _controlPoint = _findControlPoint(_midx,
                _midy,
                segment,
                params.sourcePos,
                params.targetPos,
                curviness, curviness,
                distance,
                proximityLimit);

            cp1x = _controlPoint[0];
            cp2x = _controlPoint[0];
            cp1y = _controlPoint[1];
            cp2y = _controlPoint[1];

            _super.addSegment(this, "Bezier", {
                x1: _tx, y1: _ty, x2: _sx, y2: _sy,
                cp1x: cp1x, cp1y: cp1y,
                cp2x: cp2x, cp2y: cp2y
            });
        };
    };

    _jp.Connectors.StateMachine = StateMachine;
    _ju.extend(StateMachine, _jp.Connectors.AbstractBezierConnector);

}).call(typeof window !== 'undefined' ? window : this);
/*
 * This file contains the 'flowchart' connectors, consisting of vertical and horizontal line segments.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;
(function () {

    "use strict";
    var root = this, _jp = root.jsPlumb, _ju = root.jsPlumbUtil;
    var STRAIGHT = "Straight";

    var Straight = function (params) {
        this.type = STRAIGHT;
        var _super = _jp.Connectors.AbstractConnector.apply(this, arguments);

        this._compute = function (paintInfo, _) {
            _super.addSegment(this, STRAIGHT, {x1: paintInfo.sx, y1: paintInfo.sy, x2: paintInfo.startStubX, y2: paintInfo.startStubY});
            _super.addSegment(this, STRAIGHT, {x1: paintInfo.startStubX, y1: paintInfo.startStubY, x2: paintInfo.endStubX, y2: paintInfo.endStubY});
            _super.addSegment(this, STRAIGHT, {x1: paintInfo.endStubX, y1: paintInfo.endStubY, x2: paintInfo.tx, y2: paintInfo.ty});
        };
    };

    _jp.Connectors.Straight = Straight;
    _ju.extend(Straight, _jp.Connectors.AbstractConnector);

}).call(typeof window !== 'undefined' ? window : this);
/*
 * This file contains the SVG renderers.
 *
 * Copyright (c) 2010 - 2018 jsPlumb (hello@jsplumbtoolkit.com)
 * 
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 * 
 * Dual licensed under the MIT and GPL2 licenses.
 */
;
(function () {

// ************************** SVG utility methods ********************************************	

    "use strict";
    var root = this, _jp = root.jsPlumb, _ju = root.jsPlumbUtil;

    var svgAttributeMap = {
            "stroke-linejoin": "stroke-linejoin",
            "stroke-dashoffset": "stroke-dashoffset",
            "stroke-linecap": "stroke-linecap"
        },
        STROKE_DASHARRAY = "stroke-dasharray",
        DASHSTYLE = "dashstyle",
        LINEAR_GRADIENT = "linearGradient",
        RADIAL_GRADIENT = "radialGradient",
        DEFS = "defs",
        FILL = "fill",
        STOP = "stop",
        STROKE = "stroke",
        STROKE_WIDTH = "stroke-width",
        STYLE = "style",
        NONE = "none",
        JSPLUMB_GRADIENT = "jsplumb_gradient_",
        LINE_WIDTH = "strokeWidth",
        ns = {
            svg: "http://www.w3.org/2000/svg"
        },
        _attr = function (node, attributes) {
            for (var i in attributes) {
                node.setAttribute(i, "" + attributes[i]);
            }
        },
        _node = function (name, attributes) {
            attributes = attributes || {};
            attributes.version = "1.1";
            attributes.xmlns = ns.svg;
            return _jp.createElementNS(ns.svg, name, null, null, attributes);
        },
        _pos = function (d) {
            return "position:absolute;left:" + d[0] + "px;top:" + d[1] + "px";
        },
        _clearGradient = function (parent) {
            var els = parent.querySelectorAll(" defs,linearGradient,radialGradient");
            for (var i = 0; i < els.length; i++) {
                els[i].parentNode.removeChild(els[i]);
            }
        },
        _updateGradient = function (parent, node, style, dimensions, uiComponent) {
            var id = JSPLUMB_GRADIENT + uiComponent._jsPlumb.instance.idstamp();
            // first clear out any existing gradient
            _clearGradient(parent);
            // this checks for an 'offset' property in the gradient, and in the absence of it, assumes
            // we want a linear gradient. if it's there, we create a radial gradient.
            // it is possible that a more explicit means of defining the gradient type would be
            // better. relying on 'offset' means that we can never have a radial gradient that uses
            // some default offset, for instance.
            // issue 244 suggested the 'gradientUnits' attribute; without this, straight/flowchart connectors with gradients would
            // not show gradients when the line was perfectly horizontal or vertical.
            var g;
            if (!style.gradient.offset) {
                g = _node(LINEAR_GRADIENT, {id: id, gradientUnits: "userSpaceOnUse"});
            }
            else {
                g = _node(RADIAL_GRADIENT, { id: id });
            }

            var defs = _node(DEFS);
            parent.appendChild(defs);
            defs.appendChild(g);

            // the svg radial gradient seems to treat stops in the reverse
            // order to how canvas does it.  so we want to keep all the maths the same, but
            // iterate the actual style declarations in reverse order, if the x indexes are not in order.
            for (var i = 0; i < style.gradient.stops.length; i++) {
                var styleToUse = uiComponent.segment === 1 || uiComponent.segment === 2 ? i : style.gradient.stops.length - 1 - i,
                    stopColor = style.gradient.stops[styleToUse][1],
                    s = _node(STOP, {"offset": Math.floor(style.gradient.stops[i][0] * 100) + "%", "stop-color": stopColor});

                g.appendChild(s);
            }
            var applyGradientTo = style.stroke ? STROKE : FILL;
            node.setAttribute(applyGradientTo, "url(#" + id + ")");
        },
        _applyStyles = function (parent, node, style, dimensions, uiComponent) {

            node.setAttribute(FILL, style.fill ? style.fill : NONE);
            node.setAttribute(STROKE, style.stroke ? style.stroke : NONE);

            if (style.gradient) {
                _updateGradient(parent, node, style, dimensions, uiComponent);
            }
            else {
                // make sure we clear any existing gradient
                _clearGradient(parent);
                node.setAttribute(STYLE, "");
            }

            if (style.strokeWidth) {
                node.setAttribute(STROKE_WIDTH, style.strokeWidth);
            }

            // in SVG there is a stroke-dasharray attribute we can set, and its syntax looks like
            // the syntax in VML but is actually kind of nasty: values are given in the pixel
            // coordinate space, whereas in VML they are multiples of the width of the stroked
            // line, which makes a lot more sense.  for that reason, jsPlumb is supporting both
            // the native svg 'stroke-dasharray' attribute, and also the 'dashstyle' concept from
            // VML, which will be the preferred method.  the code below this converts a dashstyle
            // attribute given in terms of stroke width into a pixel representation, by using the
            // stroke's lineWidth.
            if (style[DASHSTYLE] && style[LINE_WIDTH] && !style[STROKE_DASHARRAY]) {
                var sep = style[DASHSTYLE].indexOf(",") === -1 ? " " : ",",
                    parts = style[DASHSTYLE].split(sep),
                    styleToUse = "";
                parts.forEach(function (p) {
                    styleToUse += (Math.floor(p * style.strokeWidth) + sep);
                });
                node.setAttribute(STROKE_DASHARRAY, styleToUse);
            }
            else if (style[STROKE_DASHARRAY]) {
                node.setAttribute(STROKE_DASHARRAY, style[STROKE_DASHARRAY]);
            }

            // extra attributes such as join type, dash offset.
            for (var i in svgAttributeMap) {
                if (style[i]) {
                    node.setAttribute(svgAttributeMap[i], style[i]);
                }
            }
        },
        _appendAtIndex = function (svg, path, idx) {
            if (svg.childNodes.length > idx) {
                svg.insertBefore(path, svg.childNodes[idx]);
            }
            else {
                svg.appendChild(path);
            }
        };

    /**
     utility methods for other objects to use.
     */
    _ju.svg = {
        node: _node,
        attr: _attr,
        pos: _pos
    };

    // ************************** / SVG utility methods ********************************************

    /*
     * Base class for SVG components.
     */
    var SvgComponent = function (params) {
        var pointerEventsSpec = params.pointerEventsSpec || "all", renderer = {};

        _jp.jsPlumbUIComponent.apply(this, params.originalArgs);
        this.canvas = null;
        this.path = null;
        this.svg = null;
        this.bgCanvas = null;

        var clazz = params.cssClass + " " + (params.originalArgs[0].cssClass || ""),
            svgParams = {
                "style": "",
                "width": 0,
                "height": 0,
                "pointer-events": pointerEventsSpec,
                "position": "absolute"
            };

        this.svg = _node("svg", svgParams);

        if (params.useDivWrapper) {
            this.canvas = _jp.createElement("div", { position : "absolute" });
            _ju.sizeElement(this.canvas, 0, 0, 1, 1);
            this.canvas.className = clazz;
        }
        else {
            _attr(this.svg, { "class": clazz });
            this.canvas = this.svg;
        }

        params._jsPlumb.appendElement(this.canvas, params.originalArgs[0].parent);
        if (params.useDivWrapper) {
            this.canvas.appendChild(this.svg);
        }

        var displayElements = [ this.canvas ];
        this.getDisplayElements = function () {
            return displayElements;
        };

        this.appendDisplayElement = function (el) {
            displayElements.push(el);
        };

        this.paint = function (style, anchor, extents) {
            if (style != null) {

                var xy = [ this.x, this.y ], wh = [ this.w, this.h ], p;
                if (extents != null) {
                    if (extents.xmin < 0) {
                        xy[0] += extents.xmin;
                    }
                    if (extents.ymin < 0) {
                        xy[1] += extents.ymin;
                    }
                    wh[0] = extents.xmax + ((extents.xmin < 0) ? -extents.xmin : 0);
                    wh[1] = extents.ymax + ((extents.ymin < 0) ? -extents.ymin : 0);
                }

                if (params.useDivWrapper) {
                    _ju.sizeElement(this.canvas, xy[0], xy[1], wh[0], wh[1]);
                    xy[0] = 0;
                    xy[1] = 0;
                    p = _pos([ 0, 0 ]);
                }
                else {
                    p = _pos([ xy[0], xy[1] ]);
                }

                renderer.paint.apply(this, arguments);

                _attr(this.svg, {
                    "style": p,
                    "width": wh[0] || 0,
                    "height": wh[1] || 0
                });
            }
        };

        return {
            renderer: renderer
        };
    };

    _ju.extend(SvgComponent, _jp.jsPlumbUIComponent, {
        cleanup: function (force) {
            if (force || this.typeId == null) {
                if (this.canvas) {
                    this.canvas._jsPlumb = null;
                }
                if (this.svg) {
                    this.svg._jsPlumb = null;
                }
                if (this.bgCanvas) {
                    this.bgCanvas._jsPlumb = null;
                }

                if (this.canvas && this.canvas.parentNode) {
                    this.canvas.parentNode.removeChild(this.canvas);
                }
                if (this.bgCanvas && this.bgCanvas.parentNode) {
                    this.canvas.parentNode.removeChild(this.canvas);
                }

                this.svg = null;
                this.canvas = null;
                this.path = null;
                this.group = null;
            }
            else {
                // if not a forced cleanup, just detach from DOM for now.
                if (this.canvas && this.canvas.parentNode) {
                    this.canvas.parentNode.removeChild(this.canvas);
                }
                if (this.bgCanvas && this.bgCanvas.parentNode) {
                    this.bgCanvas.parentNode.removeChild(this.bgCanvas);
                }
            }
        },
        reattach:function(instance) {
            var c = instance.getContainer();
            if (this.canvas && this.canvas.parentNode == null) {
                c.appendChild(this.canvas);
            }
            if (this.bgCanvas && this.bgCanvas.parentNode == null) {
                c.appendChild(this.bgCanvas);
            }
        },
        setVisible: function (v) {
            if (this.canvas) {
                this.canvas.style.display = v ? "block" : "none";
            }
        }
    });

    /*
     * Base class for SVG connectors.
     */
    _jp.ConnectorRenderers.svg = function (params) {
        var self = this,
            _super = SvgComponent.apply(this, [
                {
                    cssClass: params._jsPlumb.connectorClass,
                    originalArgs: arguments,
                    pointerEventsSpec: "none",
                    _jsPlumb: params._jsPlumb
                }
            ]);

        _super.renderer.paint = function (style, anchor, extents) {

            var segments = self.getSegments(), p = "", offset = [0, 0];
            if (extents.xmin < 0) {
                offset[0] = -extents.xmin;
            }
            if (extents.ymin < 0) {
                offset[1] = -extents.ymin;
            }

            if (segments.length > 0) {

                p = self.getPathData();

                var a = {
                        d: p,
                        transform: "translate(" + offset[0] + "," + offset[1] + ")",
                        "pointer-events": params["pointer-events"] || "visibleStroke"
                    },
                    outlineStyle = null,
                    d = [self.x, self.y, self.w, self.h];

                // outline style.  actually means drawing an svg object underneath the main one.
                if (style.outlineStroke) {
                    var outlineWidth = style.outlineWidth || 1,
                        outlineStrokeWidth = style.strokeWidth + (2 * outlineWidth);
                    outlineStyle = _jp.extend({}, style);
                    delete outlineStyle.gradient;
                    outlineStyle.stroke = style.outlineStroke;
                    outlineStyle.strokeWidth = outlineStrokeWidth;

                    if (self.bgPath == null) {
                        self.bgPath = _node("path", a);
                        _jp.addClass(self.bgPath, _jp.connectorOutlineClass);
                        _appendAtIndex(self.svg, self.bgPath, 0);
                    }
                    else {
                        _attr(self.bgPath, a);
                    }

                    _applyStyles(self.svg, self.bgPath, outlineStyle, d, self);
                }

                if (self.path == null) {
                    self.path = _node("path", a);
                    _appendAtIndex(self.svg, self.path, style.outlineStroke ? 1 : 0);
                }
                else {
                    _attr(self.path, a);
                }

                _applyStyles(self.svg, self.path, style, d, self);
            }
        };
    };
    _ju.extend(_jp.ConnectorRenderers.svg, SvgComponent);

// ******************************* svg segment renderer *****************************************************	


// ******************************* /svg segments *****************************************************

    /*
     * Base class for SVG endpoints.
     */
    var SvgEndpoint = _jp.SvgEndpoint = function (params) {
        var _super = SvgComponent.apply(this, [
            {
                cssClass: params._jsPlumb.endpointClass,
                originalArgs: arguments,
                pointerEventsSpec: "all",
                useDivWrapper: true,
                _jsPlumb: params._jsPlumb
            }
        ]);

        _super.renderer.paint = function (style) {
            var s = _jp.extend({}, style);
            if (s.outlineStroke) {
                s.stroke = s.outlineStroke;
            }

            if (this.node == null) {
                this.node = this.makeNode(s);
                this.svg.appendChild(this.node);
            }
            else if (this.updateNode != null) {
                this.updateNode(this.node);
            }
            _applyStyles(this.svg, this.node, s, [ this.x, this.y, this.w, this.h ], this);
            _pos(this.node, [ this.x, this.y ]);
        }.bind(this);

    };
    _ju.extend(SvgEndpoint, SvgComponent);

    /*
     * SVG Dot Endpoint
     */
    _jp.Endpoints.svg.Dot = function () {
        _jp.Endpoints.Dot.apply(this, arguments);
        SvgEndpoint.apply(this, arguments);
        this.makeNode = function (style) {
            return _node("circle", {
                "cx": this.w / 2,
                "cy": this.h / 2,
                "r": this.radius
            });
        };
        this.updateNode = function (node) {
            _attr(node, {
                "cx": this.w / 2,
                "cy": this.h / 2,
                "r": this.radius
            });
        };
    };
    _ju.extend(_jp.Endpoints.svg.Dot, [_jp.Endpoints.Dot, SvgEndpoint]);

    /*
     * SVG Rectangle Endpoint
     */
    _jp.Endpoints.svg.Rectangle = function () {
        _jp.Endpoints.Rectangle.apply(this, arguments);
        SvgEndpoint.apply(this, arguments);
        this.makeNode = function (style) {
            return _node("rect", {
                "width": this.w,
                "height": this.h
            });
        };
        this.updateNode = function (node) {
            _attr(node, {
                "width": this.w,
                "height": this.h
            });
        };
    };
    _ju.extend(_jp.Endpoints.svg.Rectangle, [_jp.Endpoints.Rectangle, SvgEndpoint]);

    /*
     * SVG Image Endpoint is the default image endpoint.
     */
    _jp.Endpoints.svg.Image = _jp.Endpoints.Image;
    /*
     * Blank endpoint in svg renderer is the default Blank endpoint.
     */
    _jp.Endpoints.svg.Blank = _jp.Endpoints.Blank;
    /*
     * Label overlay in svg renderer is the default Label overlay.
     */
    _jp.Overlays.svg.Label = _jp.Overlays.Label;
    /*
     * Custom overlay in svg renderer is the default Custom overlay.
     */
    _jp.Overlays.svg.Custom = _jp.Overlays.Custom;

    var AbstractSvgArrowOverlay = function (superclass, originalArgs) {
        superclass.apply(this, originalArgs);
        _jp.jsPlumbUIComponent.apply(this, originalArgs);
        this.isAppendedAtTopLevel = false;
        var self = this;
        this.path = null;
        this.paint = function (params, containerExtents) {
            // only draws on connections, not endpoints.
            if (params.component.svg && containerExtents) {
                if (this.path == null) {
                    this.path = _node("path", {
                        "pointer-events": "all"
                    });
                    params.component.svg.appendChild(this.path);
                    if (this.elementCreated) {
                        this.elementCreated(this.path, params.component);
                    }

                    this.canvas = params.component.svg; // for the sake of completeness; this behaves the same as other overlays
                }
                var clazz = originalArgs && (originalArgs.length === 1) ? (originalArgs[0].cssClass || "") : "",
                    offset = [0, 0];

                if (containerExtents.xmin < 0) {
                    offset[0] = -containerExtents.xmin;
                }
                if (containerExtents.ymin < 0) {
                    offset[1] = -containerExtents.ymin;
                }

                _attr(this.path, {
                    "d": makePath(params.d),
                    "class": clazz,
                    stroke: params.stroke ? params.stroke : null,
                    fill: params.fill ? params.fill : null,
                    transform: "translate(" + offset[0] + "," + offset[1] + ")"
                });
            }
        };
        var makePath = function (d) {
            return (isNaN(d.cxy.x) || isNaN(d.cxy.y)) ? "" : "M" + d.hxy.x + "," + d.hxy.y +
                " L" + d.tail[0].x + "," + d.tail[0].y +
                " L" + d.cxy.x + "," + d.cxy.y +
                " L" + d.tail[1].x + "," + d.tail[1].y +
                " L" + d.hxy.x + "," + d.hxy.y;
        };
        this.transfer = function(target) {
            if (target.canvas && this.path && this.path.parentNode) {
                this.path.parentNode.removeChild(this.path);
                target.canvas.appendChild(this.path);
            }
        };
    };
    _ju.extend(AbstractSvgArrowOverlay, [_jp.jsPlumbUIComponent, _jp.Overlays.AbstractOverlay], {
        cleanup: function (force) {
            if (this.path != null) {
                if (force) {
                    this._jsPlumb.instance.removeElement(this.path);
                }
                else {
                    if (this.path.parentNode) {
                        this.path.parentNode.removeChild(this.path);
                    }
                }
            }
        },
        reattach:function(instance, component) {
            if (this.path && component.canvas) {
                component.canvas.appendChild(this.path);
            }
        },
        setVisible: function (v) {
            if (this.path != null) {
                (this.path.style.display = (v ? "block" : "none"));
            }
        }
    });

    _jp.Overlays.svg.Arrow = function () {
        AbstractSvgArrowOverlay.apply(this, [_jp.Overlays.Arrow, arguments]);
    };
    _ju.extend(_jp.Overlays.svg.Arrow, [ _jp.Overlays.Arrow, AbstractSvgArrowOverlay ]);

    _jp.Overlays.svg.PlainArrow = function () {
        AbstractSvgArrowOverlay.apply(this, [_jp.Overlays.PlainArrow, arguments]);
    };
    _ju.extend(_jp.Overlays.svg.PlainArrow, [ _jp.Overlays.PlainArrow, AbstractSvgArrowOverlay ]);

    _jp.Overlays.svg.Diamond = function () {
        AbstractSvgArrowOverlay.apply(this, [_jp.Overlays.Diamond, arguments]);
    };
    _ju.extend(_jp.Overlays.svg.Diamond, [ _jp.Overlays.Diamond, AbstractSvgArrowOverlay ]);

    // a test
    _jp.Overlays.svg.GuideLines = function () {
        var path = null, self = this, p1_1, p1_2;
        _jp.Overlays.GuideLines.apply(this, arguments);
        this.paint = function (params, containerExtents) {
            if (path == null) {
                path = _node("path");
                params.connector.svg.appendChild(path);
                self.attachListeners(path, params.connector);
                self.attachListeners(path, self);

                p1_1 = _node("path");
                params.connector.svg.appendChild(p1_1);
                self.attachListeners(p1_1, params.connector);
                self.attachListeners(p1_1, self);

                p1_2 = _node("path");
                params.connector.svg.appendChild(p1_2);
                self.attachListeners(p1_2, params.connector);
                self.attachListeners(p1_2, self);
            }

            var offset = [0, 0];
            if (containerExtents.xmin < 0) {
                offset[0] = -containerExtents.xmin;
            }
            if (containerExtents.ymin < 0) {
                offset[1] = -containerExtents.ymin;
            }

            _attr(path, {
                "d": makePath(params.head, params.tail),
                stroke: "red",
                fill: null,
                transform: "translate(" + offset[0] + "," + offset[1] + ")"
            });

            _attr(p1_1, {
                "d": makePath(params.tailLine[0], params.tailLine[1]),
                stroke: "blue",
                fill: null,
                transform: "translate(" + offset[0] + "," + offset[1] + ")"
            });

            _attr(p1_2, {
                "d": makePath(params.headLine[0], params.headLine[1]),
                stroke: "green",
                fill: null,
                transform: "translate(" + offset[0] + "," + offset[1] + ")"
            });
        };

        var makePath = function (d1, d2) {
            return "M " + d1.x + "," + d1.y +
                " L" + d2.x + "," + d2.y;
        };
    };
    _ju.extend(_jp.Overlays.svg.GuideLines, _jp.Overlays.GuideLines);
}).call(typeof window !== 'undefined' ? window : this);

/*
 * This file contains code used when jsPlumb is being rendered in a DOM.
 *
 * Copyright (c) 2010 - 2019 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;
(function () {

    "use strict";

    var root = this, _jp = root.jsPlumb, _ju = root.jsPlumbUtil,
        _jk = root.Katavorio, _jg = root.Biltong;

    var _getEventManager = function(instance) {
        var e = instance._mottle;
        if (!e) {
            e = instance._mottle = new root.Mottle();
        }
        return e;
    };

    var _getDragManager = function (instance, category) {

        category = category || "main";
        var key = "_katavorio_" + category;
        var k = instance[key],
            e = instance.getEventManager();

        if (!k) {
            k = new _jk({
                bind: e.on,
                unbind: e.off,
                getSize: _jp.getSize,
                getConstrainingRectangle:function(el) {
                    return [ el.parentNode.scrollWidth, el.parentNode.scrollHeight ];
                },
                getPosition: function (el, relativeToRoot) {
                    // if this is a nested draggable then compute the offset against its own offsetParent, otherwise
                    // compute against the Container's origin. see also the getUIPosition method below.
                    var o = instance.getOffset(el, relativeToRoot, el._katavorioDrag ? el.offsetParent : null);
                    return [o.left, o.top];
                },
                setPosition: function (el, xy) {
                    el.style.left = xy[0] + "px";
                    el.style.top = xy[1] + "px";
                },
                addClass: _jp.addClass,
                removeClass: _jp.removeClass,
                intersects: _jg.intersects,
                indexOf: function(l, i) { return l.indexOf(i); },
                scope:instance.getDefaultScope(),
                css: {
                    noSelect: instance.dragSelectClass,
                    droppable: "jtk-droppable",
                    draggable: "jtk-draggable",
                    drag: "jtk-drag",
                    selected: "jtk-drag-selected",
                    active: "jtk-drag-active",
                    hover: "jtk-drag-hover",
                    ghostProxy:"jtk-ghost-proxy"
                }
            });
            k.setZoom(instance.getZoom());
            instance[key] = k;
            instance.bind("zoom", k.setZoom);
        }
        return k;
    };

    var _dragStart=function(params) {
        var options = params.el._jsPlumbDragOptions;
        var cont = true;
        if (options.canDrag) {
            cont = options.canDrag();
        }
        if (cont) {
            this.setHoverSuspended(true);
            this.select({source: params.el}).addClass(this.elementDraggingClass + " " + this.sourceElementDraggingClass, true);
            this.select({target: params.el}).addClass(this.elementDraggingClass + " " + this.targetElementDraggingClass, true);
            this.setConnectionBeingDragged(true);
        }
        return cont;
    };
    var _dragMove=function(params) {
        var ui = this.getUIPosition(arguments, this.getZoom());
        if (ui != null) {
            var o = params.el._jsPlumbDragOptions;
            this.draw(params.el, ui, null, true);
            if (o._dragging) {
                this.addClass(params.el, "jtk-dragged");
            }
            o._dragging = true;
        }
    };
    var _dragStop=function(params) {
        var elements = params.selection, uip;

        var _one = function (_e) {
            if (_e[1] != null) {
                // run the reported offset through the code that takes parent containers
                // into account, to adjust if necessary (issue 554)
                uip = this.getUIPosition([{
                    el:_e[2].el,
                    pos:[_e[1].left, _e[1].top]
                }]);
                this.draw(_e[2].el, uip);
            }

            delete _e[0]._jsPlumbDragOptions._dragging;

            this.removeClass(_e[0], "jtk-dragged");
            this.select({source: _e[2].el}).removeClass(this.elementDraggingClass + " " + this.sourceElementDraggingClass, true);
            this.select({target: _e[2].el}).removeClass(this.elementDraggingClass + " " + this.targetElementDraggingClass, true);
            this.getDragManager().dragEnded(_e[2].el);
        }.bind(this);

        for (var i = 0; i < elements.length; i++) {
            _one(elements[i]);
        }

        this.setHoverSuspended(false);
        this.setConnectionBeingDragged(false);
    };

    var _animProps = function (o, p) {
        var _one = function (pName) {
            if (p[pName] != null) {
                if (_ju.isString(p[pName])) {
                    var m = p[pName].match(/-=/) ? -1 : 1,
                        v = p[pName].substring(2);
                    return o[pName] + (m * v);
                }
                else {
                    return p[pName];
                }
            }
            else {
                return o[pName];
            }
        };
        return [ _one("left"), _one("top") ];
    };

    var _genLoc = function (prefix, e) {
            if (e == null) {
                return [ 0, 0 ];
            }
            var ts = _touches(e), t = _getTouch(ts, 0);
            return [t[prefix + "X"], t[prefix + "Y"]];
        },
        _pageLocation = _genLoc.bind(this, "page"),
        _screenLocation = _genLoc.bind(this, "screen"),
        _clientLocation = _genLoc.bind(this, "client"),
        _getTouch = function (touches, idx) {
            return touches.item ? touches.item(idx) : touches[idx];
        },
        _touches = function (e) {
            return e.touches && e.touches.length > 0 ? e.touches :
                e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches :
                    e.targetTouches && e.targetTouches.length > 0 ? e.targetTouches :
                        [ e ];
        };

    /**
     Manages dragging for some instance of jsPlumb.

     TODO instead of this being accessed directly, it should subscribe to events on the jsPlumb instance: every method
     in here is called directly by jsPlumb. But what should happen is that we have unpublished events that this listens
     to.  The only trick is getting one of these instantiated with every jsPlumb instance: it needs to have a hook somehow.
     Basically the general idea is to pull ALL the drag code out (prototype method registrations plus this) into a
     dedicated drag script), that does not necessarily need to be included.


     */
    var DragManager = function (_currentInstance) {
        var _draggables = {}, _dlist = [], _delements = {}, _elementsWithEndpoints = {},
            // elementids mapped to the draggable to which they belong.
            _draggablesForElements = {};

        /**
         register some element as draggable.  right now the drag init stuff is done elsewhere, and it is
         possible that will continue to be the case.
         */
        this.register = function (el) {
            var id = _currentInstance.getId(el),
                parentOffset;

            if (!_draggables[id]) {
                _draggables[id] = el;
                _dlist.push(el);
                _delements[id] = {};
            }

            // look for child elements that have endpoints and register them against this draggable.
            var _oneLevel = function (p) {
                if (p) {
                    for (var i = 0; i < p.childNodes.length; i++) {
                        if (p.childNodes[i].nodeType !== 3 && p.childNodes[i].nodeType !== 8) {
                            var cEl = jsPlumb.getElement(p.childNodes[i]),
                                cid = _currentInstance.getId(p.childNodes[i], null, true);
                            if (cid && _elementsWithEndpoints[cid] && _elementsWithEndpoints[cid] > 0) {
                                if (!parentOffset) {
                                    parentOffset = _currentInstance.getOffset(el);
                                }
                                var cOff = _currentInstance.getOffset(cEl);
                                _delements[id][cid] = {
                                    id: cid,
                                    offset: {
                                        left: cOff.left - parentOffset.left,
                                        top: cOff.top - parentOffset.top
                                    }
                                };
                                _draggablesForElements[cid] = id;
                            }
                            _oneLevel(p.childNodes[i]);
                        }
                    }
                }
            };

            _oneLevel(el);
        };

        // refresh the offsets for child elements of this element.
        this.updateOffsets = function (elId, childOffsetOverrides) {
            if (elId != null) {
                childOffsetOverrides = childOffsetOverrides || {};
                var domEl = jsPlumb.getElement(elId),
                    id = _currentInstance.getId(domEl),
                    children = _delements[id],
                    parentOffset;

                if (children) {
                    for (var i in children) {
                        if (children.hasOwnProperty(i)) {
                            var cel = jsPlumb.getElement(i),
                                cOff = childOffsetOverrides[i] || _currentInstance.getOffset(cel);

                            // do not update if we have a value already and we'd just be writing 0,0
                            if (cel.offsetParent == null && _delements[id][i] != null) {
                                continue;
                            }

                            if (!parentOffset) {
                                parentOffset = _currentInstance.getOffset(domEl);
                            }

                            _delements[id][i] = {
                                id: i,
                                offset: {
                                    left: cOff.left - parentOffset.left,
                                    top: cOff.top - parentOffset.top
                                }
                            };
                            _draggablesForElements[i] = id;
                        }
                    }
                }
            }
        };

        /**
         notification that an endpoint was added to the given el.  we go up from that el's parent
         node, looking for a parent that has been registered as a draggable. if we find one, we add this
         el to that parent's list of elements to update on drag (if it is not there already)
         */
        this.endpointAdded = function (el, id) {

            id = id || _currentInstance.getId(el);

            var b = document.body,
                p = el.parentNode;

            _elementsWithEndpoints[id] = _elementsWithEndpoints[id] ? _elementsWithEndpoints[id] + 1 : 1;

            while (p != null && p !== b) {
                var pid = _currentInstance.getId(p, null, true);
                if (pid && _draggables[pid]) {
                    var pLoc = _currentInstance.getOffset(p);

                    if (_delements[pid][id] == null) {
                        var cLoc = _currentInstance.getOffset(el);
                        _delements[pid][id] = {
                            id: id,
                            offset: {
                                left: cLoc.left - pLoc.left,
                                top: cLoc.top - pLoc.top
                            }
                        };
                        _draggablesForElements[id] = pid;
                    }
                    break;
                }
                p = p.parentNode;
            }
        };

        this.endpointDeleted = function (endpoint) {
            if (_elementsWithEndpoints[endpoint.elementId]) {
                _elementsWithEndpoints[endpoint.elementId]--;
                if (_elementsWithEndpoints[endpoint.elementId] <= 0) {
                    for (var i in _delements) {
                        if (_delements.hasOwnProperty(i) && _delements[i]) {
                            delete _delements[i][endpoint.elementId];
                            delete _draggablesForElements[endpoint.elementId];
                        }
                    }
                }
            }
        };

        this.changeId = function (oldId, newId) {
            _delements[newId] = _delements[oldId];
            _delements[oldId] = {};
            _draggablesForElements[newId] = _draggablesForElements[oldId];
            _draggablesForElements[oldId] = null;
        };

        this.getElementsForDraggable = function (id) {
            return _delements[id];
        };

        this.elementRemoved = function (elementId) {
            var elId = _draggablesForElements[elementId];
            if (elId) {
                delete _delements[elId][elementId];
                delete _draggablesForElements[elementId];
            }
        };

        this.reset = function () {
            _draggables = {};
            _dlist = [];
            _delements = {};
            _elementsWithEndpoints = {};
        };

        //
        // notification drag ended. We check automatically if need to update some
        // ancestor's offsets.
        //
        this.dragEnded = function (el) {
            if (el.offsetParent != null) {
                var id = _currentInstance.getId(el),
                    ancestor = _draggablesForElements[id];

                if (ancestor) {
                    this.updateOffsets(ancestor);
                }
            }
        };

        this.setParent = function (el, elId, p, pId, currentChildLocation) {
            var current = _draggablesForElements[elId];
            if (!_delements[pId]) {
                _delements[pId] = {};
            }
            var pLoc = _currentInstance.getOffset(p),
                cLoc = currentChildLocation || _currentInstance.getOffset(el);

            if (current && _delements[current]) {
                delete _delements[current][elId];
            }

            _delements[pId][elId] = {
                id:elId,
                offset : {
                    left: cLoc.left - pLoc.left,
                    top: cLoc.top - pLoc.top
                }
            };
            _draggablesForElements[elId] = pId;
        };

        this.clearParent = function(el, elId) {
            var current = _draggablesForElements[elId];
            if (current) {
                delete _delements[current][elId];
                delete _draggablesForElements[elId];
            }
        };

        this.revalidateParent = function(el, elId, childOffset) {
            var current = _draggablesForElements[elId];
            if (current) {
                var co = {};
                co[elId] = childOffset;
                this.updateOffsets(current, co);
                _currentInstance.revalidate(current);
            }
        };

        this.getDragAncestor = function (el) {
            var de = jsPlumb.getElement(el),
                id = _currentInstance.getId(de),
                aid = _draggablesForElements[id];

            if (aid) {
                return jsPlumb.getElement(aid);
            }
            else {
                return null;
            }
        };

    };

    var _setClassName = function (el, cn, classList) {
            cn = _ju.fastTrim(cn);
            if (typeof el.className.baseVal !== "undefined") {
                el.className.baseVal = cn;
            }
            else {
                el.className = cn;
            }

            // recent (i currently have  61.0.3163.100) version of chrome do not update classList when you set the base val
            // of an svg element's className. in the long run we'd like to move to just using classList anyway
            try {
                var cl = el.classList;
                if (cl != null) {
                    while (cl.length > 0) {
                        cl.remove(cl.item(0));
                    }
                    for (var i = 0; i < classList.length; i++) {
                        if (classList[i]) {
                            cl.add(classList[i]);
                        }
                    }
                }
            }
            catch(e) {
                // not fatal
                _ju.log("JSPLUMB: cannot set class list", e);
            }
        },
        _getClassName = function (el) {
            return (typeof el.className.baseVal === "undefined") ? el.className : el.className.baseVal;
        },
        _classManip = function (el, classesToAdd, classesToRemove) {
            classesToAdd = classesToAdd == null ? [] : _ju.isArray(classesToAdd) ? classesToAdd : classesToAdd.split(/\s+/);
            classesToRemove = classesToRemove == null ? [] : _ju.isArray(classesToRemove) ? classesToRemove : classesToRemove.split(/\s+/);

            var className = _getClassName(el),
                curClasses = className.split(/\s+/);

            var _oneSet = function (add, classes) {
                for (var i = 0; i < classes.length; i++) {
                    if (add) {
                        if (curClasses.indexOf(classes[i]) === -1) {
                            curClasses.push(classes[i]);
                        }
                    }
                    else {
                        var idx = curClasses.indexOf(classes[i]);
                        if (idx !== -1) {
                            curClasses.splice(idx, 1);
                        }
                    }
                }
            };

            _oneSet(true, classesToAdd);
            _oneSet(false, classesToRemove);

            _setClassName(el, curClasses.join(" "), curClasses);
        };

    root.jsPlumb.extend(root.jsPlumbInstance.prototype, {

        headless: false,

        pageLocation: _pageLocation,
        screenLocation: _screenLocation,
        clientLocation: _clientLocation,

        getDragManager:function() {
            if (this.dragManager == null) {
                this.dragManager = new DragManager(this);
            }

            return this.dragManager;
        },

        recalculateOffsets:function(elId) {
            this.getDragManager().updateOffsets(elId);
        },

        createElement:function(tag, style, clazz, atts) {
            return this.createElementNS(null, tag, style, clazz, atts);
        },

        createElementNS:function(ns, tag, style, clazz, atts) {
            var e = ns == null ? document.createElement(tag) : document.createElementNS(ns, tag);
            var i;
            style = style || {};
            for (i in style) {
                e.style[i] = style[i];
            }

            if (clazz) {
                e.className = clazz;
            }

            atts = atts || {};
            for (i in atts) {
                e.setAttribute(i, "" + atts[i]);
            }

            return e;
        },

        getAttribute: function (el, attName) {
            return el.getAttribute != null ? el.getAttribute(attName) : null;
        },

        setAttribute: function (el, a, v) {
            if (el.setAttribute != null) {
                el.setAttribute(a, v);
            }
        },

        setAttributes: function (el, atts) {
            for (var i in atts) {
                if (atts.hasOwnProperty(i)) {
                    el.setAttribute(i, atts[i]);
                }
            }
        },
        appendToRoot: function (node) {
            document.body.appendChild(node);
        },
        getRenderModes: function () {
            return [ "svg"  ];
        },
        getClass:_getClassName,
        addClass: function (el, clazz) {
            jsPlumb.each(el, function (e) {
                _classManip(e, clazz);
            });
        },
        hasClass: function (el, clazz) {
            el = jsPlumb.getElement(el);
            if (el.classList) {
                return el.classList.contains(clazz);
            }
            else {
                return _getClassName(el).indexOf(clazz) !== -1;
            }
        },
        removeClass: function (el, clazz) {
            jsPlumb.each(el, function (e) {
                _classManip(e, null, clazz);
            });
        },
        toggleClass:function(el, clazz) {
            if (jsPlumb.hasClass(el, clazz)) {
                jsPlumb.removeClass(el, clazz);
            } else {
                jsPlumb.addClass(el, clazz);
            }
        },
        updateClasses: function (el, toAdd, toRemove) {
            jsPlumb.each(el, function (e) {
                _classManip(e, toAdd, toRemove);
            });
        },
        setClass: function (el, clazz) {
            if (clazz != null) {
                jsPlumb.each(el, function (e) {
                    _setClassName(e, clazz, clazz.split(/\s+/));
                });
            }
        },
        setPosition: function (el, p) {
            el.style.left = p.left + "px";
            el.style.top = p.top + "px";
        },
        getPosition: function (el) {
            var _one = function (prop) {
                var v = el.style[prop];
                return v ? v.substring(0, v.length - 2) : 0;
            };
            return {
                left: _one("left"),
                top: _one("top")
            };
        },
        getStyle:function(el, prop) {
            if (typeof window.getComputedStyle !== 'undefined') {
                return getComputedStyle(el, null).getPropertyValue(prop);
            } else {
                return el.currentStyle[prop];
            }
        },
        getSelector: function (ctx, spec) {
            var sel = null;
            if (arguments.length === 1) {
                sel = ctx.nodeType != null ? ctx : document.querySelectorAll(ctx);
            }
            else {
                sel = ctx.querySelectorAll(spec);
            }

            return sel;
        },
        getOffset:function(el, relativeToRoot, container) {
            el = jsPlumb.getElement(el);
            container = container || this.getContainer();
            var out = {
                    left: el.offsetLeft,
                    top: el.offsetTop
                },
                op = (relativeToRoot  || (container != null && (el !== container && el.offsetParent !== container))) ?  el.offsetParent : null,
                _maybeAdjustScroll = function(offsetParent) {
                    if (offsetParent != null && offsetParent !== document.body && (offsetParent.scrollTop > 0 || offsetParent.scrollLeft > 0)) {
                        out.left -= offsetParent.scrollLeft;
                        out.top -= offsetParent.scrollTop;
                    }
                }.bind(this);

            while (op != null) {
                out.left += op.offsetLeft;
                out.top += op.offsetTop;
                _maybeAdjustScroll(op);
                op = relativeToRoot ? op.offsetParent :
                    op.offsetParent === container ? null : op.offsetParent;
            }

            // if container is scrolled and the element (or its offset parent) is not absolute or fixed, adjust accordingly.
            if (container != null && !relativeToRoot && (container.scrollTop > 0 || container.scrollLeft > 0)) {
                var pp = el.offsetParent != null ? this.getStyle(el.offsetParent, "position") : "static",
                    p = this.getStyle(el, "position");
                if (p !== "absolute" && p !== "fixed" && pp !== "absolute" && pp !== "fixed") {
                    out.left -= container.scrollLeft;
                    out.top -= container.scrollTop;
                }
            }
            return out;
        },
        //
        // return x+y proportion of the given element's size corresponding to the location of the given event.
        //
        getPositionOnElement: function (evt, el, zoom) {
            var box = typeof el.getBoundingClientRect !== "undefined" ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 },
                body = document.body,
                docElem = document.documentElement,
                scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop,
                scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft,
                clientTop = docElem.clientTop || body.clientTop || 0,
                clientLeft = docElem.clientLeft || body.clientLeft || 0,
                pst = 0,
                psl = 0,
                top = box.top + scrollTop - clientTop + (pst * zoom),
                left = box.left + scrollLeft - clientLeft + (psl * zoom),
                cl = jsPlumb.pageLocation(evt),
                w = box.width || (el.offsetWidth * zoom),
                h = box.height || (el.offsetHeight * zoom),
                x = (cl[0] - left) / w,
                y = (cl[1] - top) / h;

            return [ x, y ];
        },

        /**
         * Gets the absolute position of some element as read from the left/top properties in its style.
         * @method getAbsolutePosition
         * @param {Element} el The element to retrieve the absolute coordinates from. **Note** this is a DOM element, not a selector from the underlying library.
         * @return {Number[]} [left, top] pixel values.
         */
        getAbsolutePosition: function (el) {
            var _one = function (s) {
                var ss = el.style[s];
                if (ss) {
                    return parseFloat(ss.substring(0, ss.length - 2));
                }
            };
            return [ _one("left"), _one("top") ];
        },

        /**
         * Sets the absolute position of some element by setting the left/top properties in its style.
         * @method setAbsolutePosition
         * @param {Element} el The element to set the absolute coordinates on. **Note** this is a DOM element, not a selector from the underlying library.
         * @param {Number[]} xy x and y coordinates
         * @param {Number[]} [animateFrom] Optional previous xy to animate from.
         * @param {Object} [animateOptions] Options for the animation.
         */
        setAbsolutePosition: function (el, xy, animateFrom, animateOptions) {
            if (animateFrom) {
                this.animate(el, {
                    left: "+=" + (xy[0] - animateFrom[0]),
                    top: "+=" + (xy[1] - animateFrom[1])
                }, animateOptions);
            }
            else {
                el.style.left = xy[0] + "px";
                el.style.top = xy[1] + "px";
            }
        },
        /**
         * gets the size for the element, in an array : [ width, height ].
         */
        getSize: function (el) {
            return [ el.offsetWidth, el.offsetHeight ];
        },
        getWidth: function (el) {
            return el.offsetWidth;
        },
        getHeight: function (el) {
            return el.offsetHeight;
        },
        getRenderMode : function() { return "svg"; },
        draggable : function (el, options) {
            var info;
            el = _ju.isArray(el) || (el.length != null && !_ju.isString(el)) ? el: [ el ];
            Array.prototype.slice.call(el).forEach(function(_el) {
                info = this.info(_el);
                if (info.el) {
                    this._initDraggableIfNecessary(info.el, true, options, info.id, true);
                }
            }.bind(this));
            return this;
        },
        initDraggable: function (el, options, category) {
            _getDragManager(this, category).draggable(el, options);
            el._jsPlumbDragOptions = options;
        },
        destroyDraggable: function (el, category) {
            _getDragManager(this, category).destroyDraggable(el);
            delete el._jsPlumbDragOptions;
        },
        unbindDraggable: function (el, evt, fn, category) {
            _getDragManager(this, category).destroyDraggable(el, evt, fn);
        },
        setDraggable : function (element, draggable) {
            return jsPlumb.each(element, function (el) {
                if (this.isDragSupported(el)) {
                    this._draggableStates[this.getAttribute(el, "id")] = draggable;
                    this.setElementDraggable(el, draggable);
                }
            }.bind(this));
        },
        _draggableStates : {},
        /*
         * toggles the draggable state of the given element(s).
         * el is either an id, or an element object, or a list of ids/element objects.
         */
        toggleDraggable : function (el) {
            var state;
            jsPlumb.each(el, function (el) {
                var elId = this.getAttribute(el, "id");
                state = this._draggableStates[elId] == null ? false : this._draggableStates[elId];
                state = !state;
                this._draggableStates[elId] = state;
                this.setDraggable(el, state);
                return state;
            }.bind(this));
            return state;
        },
        _initDraggableIfNecessary : function (element, isDraggable, dragOptions, id, fireEvent) {
            // TODO FIRST: move to DragManager. including as much of the decision to init dragging as possible.
            if (!jsPlumb.headless) {
                var _draggable = isDraggable == null ? false : isDraggable;
                if (_draggable) {
                    if (jsPlumb.isDragSupported(element, this)) {
                        var options = dragOptions || this.Defaults.DragOptions;
                        options = jsPlumb.extend({}, options); // make a copy.
                        if (!jsPlumb.isAlreadyDraggable(element, this)) {
                            var dragEvent = jsPlumb.dragEvents.drag,
                                stopEvent = jsPlumb.dragEvents.stop,
                                startEvent = jsPlumb.dragEvents.start;

                            this.manage(id, element);

                            options[startEvent] = _ju.wrap(options[startEvent], _dragStart.bind(this));

                            options[dragEvent] = _ju.wrap(options[dragEvent], _dragMove.bind(this));

                            options[stopEvent] = _ju.wrap(options[stopEvent], _dragStop.bind(this));

                            var elId = this.getId(element); // need ID

                            this._draggableStates[elId] = true;
                            var draggable = this._draggableStates[elId];

                            options.disabled = draggable == null ? false : !draggable;
                            this.initDraggable(element, options);
                            this.getDragManager().register(element);
                            if (fireEvent) {
                                this.fire("elementDraggable", {el:element, options:options});
                            }
                        }
                        else {
                            // already draggable. attach any start, drag or stop listeners to the current Drag.
                            if (dragOptions.force) {
                                this.initDraggable(element, options);
                            }
                        }
                    }
                }
            }
        },
        animationSupported:true,
        getElement: function (el) {
            if (el == null) {
                return null;
            }
            // here we pluck the first entry if el was a list of entries.
            // this is not my favourite thing to do, but previous versions of
            // jsplumb supported jquery selectors, and it is possible a selector
            // will be passed in here.
            el = typeof el === "string" ? el : el.length != null && el.enctype == null ? el[0] : el;
            return typeof el === "string" ? document.getElementById(el) : el;
        },
        removeElement: function (element) {
            _getDragManager(this).elementRemoved(element);
            this.getEventManager().remove(element);
        },
        //
        // this adapter supports a rudimentary animation function. no easing is supported.  only
        // left/top properties are supported. property delta args are expected to be in the form
        //
        // +=x.xxxx
        //
        // or
        //
        // -=x.xxxx
        //
        doAnimate: function (el, properties, options) {
            options = options || {};
            var o = this.getOffset(el),
                ap = _animProps(o, properties),
                ldist = ap[0] - o.left,
                tdist = ap[1] - o.top,
                d = options.duration || 250,
                step = 15, steps = d / step,
                linc = (step / d) * ldist,
                tinc = (step / d) * tdist,
                idx = 0,
                _int = setInterval(function () {
                    _jp.setPosition(el, {
                        left: o.left + (linc * (idx + 1)),
                        top: o.top + (tinc * (idx + 1))
                    });
                    if (options.step != null) {
                        options.step(idx, Math.ceil(steps));
                    }
                    idx++;
                    if (idx >= steps) {
                        window.clearInterval(_int);
                        if (options.complete != null) {
                            options.complete();
                        }
                    }
                }, step);
        },
        // DRAG/DROP


        destroyDroppable: function (el, category) {
            _getDragManager(this, category).destroyDroppable(el);
        },
        unbindDroppable: function (el, evt, fn, category) {
            _getDragManager(this, category).destroyDroppable(el, evt, fn);
        },

        droppable :function(el, options) {
            el = _ju.isArray(el) || (el.length != null && !_ju.isString(el)) ? el: [ el ];
            var info;
            options = options || {};
            options.allowLoopback = false;
            Array.prototype.slice.call(el).forEach(function(_el) {
                info = this.info(_el);
                if (info.el) {
                    this.initDroppable(info.el, options);
                }
            }.bind(this));
            return this;
        },

        initDroppable: function (el, options, category) {
            _getDragManager(this, category).droppable(el, options);
        },
        isAlreadyDraggable: function (el) {
            return el._katavorioDrag != null;
        },
        isDragSupported: function (el, options) {
            return true;
        },
        isDropSupported: function (el, options) {
            return true;
        },
        isElementDraggable: function (el) {
            el = _jp.getElement(el);
            return el._katavorioDrag && el._katavorioDrag.isEnabled();
        },
        getDragObject: function (eventArgs) {
            return eventArgs[0].drag.getDragElement();
        },
        getDragScope: function (el) {
            return el._katavorioDrag && el._katavorioDrag.scopes.join(" ") || "";
        },
        getDropEvent: function (args) {
            return args[0].e;
        },
        getUIPosition: function (eventArgs, zoom) {
            // here the position reported to us by Katavorio is relative to the element's offsetParent. For top
            // level nodes that is fine, but if we have a nested draggable then its offsetParent is actually
            // not going to be the jsplumb container; it's going to be some child of that element. In that case
            // we want to adjust the UI position to account for the offsetParent's position relative to the Container
            // origin.
            var el = eventArgs[0].el;
            if (el.offsetParent == null) {
                return null;
            }
            var finalPos = eventArgs[0].finalPos || eventArgs[0].pos;
            var p = { left:finalPos[0], top:finalPos[1] };
            if (el._katavorioDrag && el.offsetParent !== this.getContainer()) {
                var oc = this.getOffset(el.offsetParent);
                p.left += oc.left;
                p.top += oc.top;
            }
            return p;
        },
        setDragFilter: function (el, filter, _exclude) {
            if (el._katavorioDrag) {
                el._katavorioDrag.setFilter(filter, _exclude);
            }
        },
        setElementDraggable: function (el, draggable) {
            el = _jp.getElement(el);
            if (el._katavorioDrag) {
                el._katavorioDrag.setEnabled(draggable);
            }
        },
        setDragScope: function (el, scope) {
            if (el._katavorioDrag) {
                el._katavorioDrag.k.setDragScope(el, scope);
            }
        },
        setDropScope:function(el, scope) {
            if (el._katavorioDrop && el._katavorioDrop.length > 0) {
                el._katavorioDrop[0].k.setDropScope(el, scope);
            }
        },
        addToPosse:function(el, spec) {
            var specs = Array.prototype.slice.call(arguments, 1);
            var dm = _getDragManager(this);
            _jp.each(el, function(_el) {
                _el = [ _jp.getElement(_el) ];
                _el.push.apply(_el, specs );
                dm.addToPosse.apply(dm, _el);
            });
        },
        setPosse:function(el, spec) {
            var specs = Array.prototype.slice.call(arguments, 1);
            var dm = _getDragManager(this);
            _jp.each(el, function(_el) {
                _el = [ _jp.getElement(_el) ];
                _el.push.apply(_el, specs );
                dm.setPosse.apply(dm, _el);
            });
        },
        removeFromPosse:function(el, posseId) {
            var specs = Array.prototype.slice.call(arguments, 1);
            var dm = _getDragManager(this);
            _jp.each(el, function(_el) {
                _el = [ _jp.getElement(_el) ];
                _el.push.apply(_el, specs );
                dm.removeFromPosse.apply(dm, _el);
            });
        },
        removeFromAllPosses:function(el) {
            var dm = _getDragManager(this);
            _jp.each(el, function(_el) { dm.removeFromAllPosses(_jp.getElement(_el)); });
        },
        setPosseState:function(el, posseId, state) {
            var dm = _getDragManager(this);
            _jp.each(el, function(_el) { dm.setPosseState(_jp.getElement(_el), posseId, state); });
        },
        dragEvents: {
            'start': 'start', 'stop': 'stop', 'drag': 'drag', 'step': 'step',
            'over': 'over', 'out': 'out', 'drop': 'drop', 'complete': 'complete',
            'beforeStart':'beforeStart'
        },
        animEvents: {
            'step': "step", 'complete': 'complete'
        },
        stopDrag: function (el) {
            if (el._katavorioDrag) {
                el._katavorioDrag.abort();
            }
        },
        addToDragSelection: function (spec) {
            _getDragManager(this).select(spec);
        },
        removeFromDragSelection: function (spec) {
            _getDragManager(this).deselect(spec);
        },
        clearDragSelection: function () {
            _getDragManager(this).deselectAll();
        },
        trigger: function (el, event, originalEvent, payload) {
            this.getEventManager().trigger(el, event, originalEvent, payload);
        },
        doReset:function() {
            // look for katavorio instances and reset each one if found.
            for (var key in this) {
                if (key.indexOf("_katavorio_") === 0) {
                    this[key].reset();
                }
            }
        },
        getEventManager:function() {
            return _getEventManager(this);
        },
        on : function(el, event, callback) {
            // TODO: here we would like to map the tap event if we know its
            // an internal bind to a click. we have to know its internal because only
            // then can we be sure that the UP event wont be consumed (tap is a synthesized
            // event from a mousedown followed by a mouseup).
            //event = { "click":"tap", "dblclick":"dbltap"}[event] || event;
            this.getEventManager().on.apply(this, arguments);
            return this;
        },
        off : function(el, event, callback) {
            this.getEventManager().off.apply(this, arguments);
            return this;
        }

    });

    var ready = function (f) {
        var _do = function () {
            if (/complete|loaded|interactive/.test(document.readyState) && typeof(document.body) !== "undefined" && document.body != null) {
                f();
            }
            else {
                setTimeout(_do, 9);
            }
        };

        _do();
    };
    ready(_jp.init);

}).call(typeof window !== 'undefined' ? window : this);
