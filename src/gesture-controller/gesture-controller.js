ym.modules.define('shri2017.imageViewer.GestureController', [
    'shri2017.imageViewer.EventManager',
    'util.extend'
], function (provide, EventManager, extend) {

    var DBL_TAP_STEP = 0.2;
    var ONE_TOUCH_SCALE_PER_PIXEL = 300;

    var Controller = function (view) {
        this._view = view;
        this._eventManager = new EventManager(
            this._view.getElement(),
            this._eventHandler.bind(this)
        );

        this._moveableBehavior = {
            // #!
            oneTouchZoom: this._proccessOneTouchZoom,
            multiTouch: this._processMultitouch,
            drag: this._processDrag
        };

        this._taps = 0;
    };

    extend(Controller.prototype, {
        destroy: function () {
            this._eventManager.destroy();
        },

        _eventHandler: function (event) {

            this._calculateTaps(event);

            // DblTap
            if (!this._activeBehavior && this._taps === 2) {
                this._taps = 0;
                this._processDbltap(event);
                return;
            }

            if (event.type === 'move') {
                if (!this._activeBehavior) {
                    if (event.pointerType === 'touch' &&
                        this._taps === 1 &&
                        this._checkMovement(this._initEvent, event) &&
                        this._initEvent.type === 'start') {
                        this._activeBehavior = 'oneTouchZoom';
                    } else if (event.distance > 0) {
                        this._activeBehavior = 'multiTouch';
                    } else if (this._checkMovement(this._initEvent, event)) {
                        this._activeBehavior = 'drag';
                    }
                }
                if (this._activeBehavior) {
                    this._moveableBehavior[this._activeBehavior].call(this, event);
                }
            } else {
                this._initState = this._view.getState();
                this._initEvent = event;
                if (this._activeBehavior) {
                    this._taps = 0;
                }
                this._activeBehavior = null;
            }
        },

        _processDrag: function (event) {
            this._view.setState({
                positionX: this._initState.positionX + (event.targetPoint.x - this._initEvent.targetPoint.x),
                positionY: this._initState.positionY + (event.targetPoint.y - this._initEvent.targetPoint.y)
            });
        },

        _proccessOneTouchZoom: function (event) {
            this._scale(
                this._initEvent.targetPoint,
                this._initState.scale + ((event.targetPoint.y - this._initEvent.targetPoint.y) / ONE_TOUCH_SCALE_PER_PIXEL)
            );
        },

        _processMultitouch: function (event) {
            this._scale(
                event.targetPoint,
                this._initState.scale * (event.distance / this._initEvent.distance)
            );
        },

        _processDbltap: function (event) {
            var state = this._view.getState();
            this._scale(
                event.targetPoint,
                state.scale + DBL_TAP_STEP
            );
        },

        _calculateTaps: function (event) {
            if (event.type === 'end') {
                // Нам нужны только лишь табы за последнюю треть секунды
                // Не учитываем местоположение табов, так как время их жизни очень маленькое
                if (!this._taps) {
                    setTimeout(function () {
                        this._taps = 0;
                    }.bind(this), 300);
                }
                if (!this._checkMovement(this._initEvent, event)) {
                    this._taps++;
                } else {
                    this._taps = 0;
                }
            }
        },

        _checkMovement: function (firstEvent, secondEvent) {
            var oldPoint = firstEvent.targetPoint;
            var newPoint = secondEvent.targetPoint;
            return Math.abs(oldPoint.x - newPoint.x) > 3 || Math.abs(oldPoint.y - newPoint.y) > 3;
        },

        _scale: function (targetPoint, newScale) {
            newScale = Math.max(newScale, 0.01);
            var imageSize = this._view.getImageSize();
            var state = this._view.getState();
            // Позиция прикосновения на изображении на текущем уровне масштаба
            var originX = targetPoint.x - state.positionX;
            var originY = targetPoint.y - state.positionY;
            // Размер изображения на текущем уровне масштаба
            var currentImageWidth = imageSize.width * state.scale;
            var currentImageHeight = imageSize.height * state.scale;
            // Относительное положение прикосновения на изображении
            var mx = originX / currentImageWidth;
            var my = originY / currentImageHeight;
            // Размер изображения с учетом нового уровня масштаба
            var newImageWidth = imageSize.width * newScale;
            var newImageHeight = imageSize.height * newScale;
            // Рассчитываем новую позицию с учетом уровня масштаба
            // и относительного положения прикосновения
            state.positionX += originX - (newImageWidth * mx);
            state.positionY += originY - (newImageHeight * my);
            // Устанавливаем текущее положение мышки как "стержневое"
            state.pivotPointX = targetPoint.x;
            state.pivotPointY = targetPoint.y;
            // Устанавливаем масштаб и угол наклона
            state.scale = newScale;
            this._view.setState(state);
        }
    });

    provide(Controller);
});
