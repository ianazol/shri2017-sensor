ym.modules.define('shri2017.imageViewer.EventManager', [
    'util.extend',
    'shri2017.imageViewer.util.timer'
], function (provide, extend, timer) {

    var EVENTS = {
        mousedown: 'start',
        mousemove: 'move',
        mouseup: 'end',

        touchstart: 'start',
        touchmove: 'move',
        touchend: 'end',
        touchcancel: 'end',

        pointerdown: 'start',
        pointermove: 'move',
        pointerup: 'end'
    };

    var ALLOWED_POINTER_TYPES = [
        'mouse', 'touch' // without 'pen'
    ];

    var MOUSE_WHEEL_STEP = 15;

    function EventManager(elem, callback) {
        this._elem = elem;
        this._callback = callback;
        this._setupListeners();

        this._pointerData = {
            list: [],
            type: null
        };
    }

    extend(EventManager.prototype, {
        destroy: function () {
            this._teardownListeners();
        },

        _setupListeners: function () {
            if (window.PointerEvent) {
                this._pointerListener = this._pointerHandler.bind(this);
                this._addEventListeners('pointerdown', this._elem, this._pointerListener);
                // Chrome for Android
                if (window.TouchEvent) {
                    this._addEventListeners('touchstart touchmove touchend touchcancel', this._elem, preventDefault);
                }
            } else {
                this._mouseListener = this._mouseEventHandler.bind(this);
                this._addEventListeners('mousedown', this._elem, this._mouseListener);
                if (window.TouchEvent) {
                    this._touchListener = this._touchEventHandler.bind(this);
                    this._addEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._touchListener);
                }
            }
            this._mouseWheelListener = this._mouseWheelHandler.bind(this);
            this._addEventListeners('wheel', this._elem, this._mouseWheelListener);
        },

        _teardownListeners: function () {
            if (window.PointerEvent) {
                this._removeEventListeners('pointerdown pointermove pointerup', this._elem, this._pointerListener);
                // Chrome for Android
                if (window.TouchEvent) {
                    this._removeEventListeners('touchstart touchmove touchend touchcancel', this._elem, preventDefault);
                }
            } else {
                this._removeEventListeners('mousedown', this._elem, this._mouseListener);
                this._removeEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
                if (window.TouchEvent) {
                    this._removeEventListeners('touchstart touchmove touchend touchcancel', this._elem, this._touchListener);
                }
            }
            this._removeEventListeners('wheel', this._elem, this._mouseWheelListener);
        },

        _addEventListeners: function (types, elem, callback) {
            types.split(' ').forEach(function (type) {
                elem.addEventListener(type, callback);
            }, this);
        },

        _removeEventListeners: function (types, elem, callback) {
            types.split(' ').forEach(function (type) {
                elem.removeEventListener(type, callback);
            }, this);
        },

        _mouseEventHandler: function (event) {
            preventDefault(event);

            if (event.type === 'mousedown') {
                this._addEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            } else if (event.type === 'mouseup') {
                this._removeEventListeners('mousemove mouseup', document.documentElement, this._mouseListener);
            }

            var elemOffset = this._calculateElementOffset(this._elem);

            this._callback({
                type: EVENTS[event.type],
                targetPoint: {
                    x: event.clientX - elemOffset.x,
                    y: event.clientY - elemOffset.y
                },
                distance: 0,
                pointerType: 'mouse'
            });
        },

        _mouseWheelHandler: function (event) {
            this._removeEventListeners('wheel', this._elem, this._mouseWheelListener);

            var distance = 100;

            var elemOffset = this._calculateElementOffset(this._elem);
            var resultEvent = {
                type: 'start',
                targetPoint: {
                    x: event.clientX - elemOffset.x,
                    y: event.clientY - elemOffset.y
                },
                distance: distance,
                pointerType: 'mouse'
            };
            var step = (event.deltaY < 0) ? MOUSE_WHEEL_STEP : -MOUSE_WHEEL_STEP;

            this._callback(resultEvent);

            timer({
                repeats: 5,
                interval: 10,
                callback: function (data) {
                    distance += step;
                    resultEvent = extend({}, resultEvent, {
                        type: data.last ? 'end' : 'move',
                        distance: distance
                    });
                    this._callback(resultEvent);
                    if (data.last) {
                        this._addEventListeners('wheel', this._elem, this._mouseWheelListener);
                    }
                }.bind(this)
            });
        },

        _touchEventHandler: function (event) {
            preventDefault(event);

            var touches = event.touches;
            // touchend/touchcancel
            if (touches.length === 0) {
                touches = event.changedTouches;
            }

            var resultEvents = this._proccesTouches(touches, 'touch');
            resultEvents.type = EVENTS[event.type];
            this._callback(resultEvents);
        },

        _pointerHandler: function (event) {
            preventDefault(event);

            // Поддерживаем только определенные типы поинтеров
            if (ALLOWED_POINTER_TYPES.indexOf(event.pointerType) === -1) {
                return;
            }

            // Если уже начался pointer-жест, то фиксируем только поинтеры с таким же pointerType
            if (this._pointerData.type &&
                this._pointerData.type != event.pointerType) {
                return;
            }

            var pointerList = this._pointerData.list;
            var resultType = EVENTS[event.type];

            if (resultType === 'end') {
                if (pointerList.length === 1) {
                    this._pointerData.type = null;
                    this._removeEventListeners('pointermove pointerup', document.documentElement, this._pointerListener);
                    // Чтобы в завершающем событии были координаты
                    pointerList = pointerList.concat();
                }
                this._replacePointer(event.pointerId);
            } else {
                if (resultType === 'start') {
                    this._addEventListeners('pointermove pointerup', document.documentElement, this._pointerListener);
                }
                this._replacePointer(event.pointerId, event);
                this._pointerData.type = event.pointerType;
            }

            var resultEvents = this._proccesTouches(pointerList, this._pointerData.type);
            resultEvents.type = resultType;
            this._callback(resultEvents);

            this._pointerData.lastEvent = event;
        },

        _proccesTouches: function (touches, pointerType) {
            var targetPoint;
            var distance = 0;
            var elemOffset = this._calculateElementOffset(this._elem);

            if (touches.length === 1) {
                targetPoint = {
                    x: touches[0].clientX,
                    y: touches[0].clientY
                };
            } else {
                targetPoint = this._calculateTargetPoint(touches[0], touches[1]);
                distance = this._calculateDistance(touches[0], touches[1]);
            }

            targetPoint.x -= elemOffset.x;
            targetPoint.y -= elemOffset.y;

            return {
                targetPoint: targetPoint,
                distance: distance,
                pointerType: pointerType
            };
        },

        _calculateTargetPoint: function (firstTouch, secondTouch) {
            return {
                x: (secondTouch.clientX + firstTouch.clientX) / 2,
                y: (secondTouch.clientY + firstTouch.clientY) / 2
            };
        },

        _calculateDistance: function (firstTouch, secondTouch) {
            return Math.sqrt(
                Math.pow(secondTouch.clientX - firstTouch.clientX, 2) +
                Math.pow(secondTouch.clientY - firstTouch.clientY, 2)
            );
        },

        _calculateElementOffset: function (elem) {
            var bounds = elem.getBoundingClientRect();
            return {
                x: bounds.left,
                y: bounds.top
            };
        },

        _replacePointer: function (pointerId, pointerEvent) {
            var pointerList = this._pointerData.list;
            var exists = pointerList.some(function (pointer, index, array) {
                if (pointer.pointerId === pointerId) {
                    if (pointerEvent) {
                        array.splice(index, 1, pointerEvent);
                    } else {
                        array.splice(index, 1);
                    }
                    return true;
                }
            }, this);
            if (!exists && pointerEvent) {
                pointerList.push(pointerEvent);
            }
        }
    });

    function preventDefault(event) {
        event.preventDefault();
    }

    provide(EventManager);
});
