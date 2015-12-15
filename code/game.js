var coin;
var death;
var jump;
var dogJump;
var overworld;
var loseSong;
var winSong;

/**
 * Read the level
 *
 * @param plan
 * @constructor
 */
function Level(plan) {
    this.width = plan[0].length;
    this.height = plan.length;
    this.grid = [];
    this.actors = [];

    for (var y = 0; y < this.height; y++) {
        var line = plan[y], gridLine = [];
        for (var x = 0; x < this.width; x++) {
            var ch = line[x], fieldType = null;
            var Actor = actorChars[ch];
            if (Actor)
                this.actors.push(new Actor(new Vector(x, y), ch));
            else {
                if (ch == "x")
                    fieldType = "wall";
                else if (ch == "!")
                    fieldType = "lava";
            }
            gridLine.push(fieldType);
        }
        this.grid.push(gridLine);
    }

    this.player = this.actors.filter(function (actor) {
        return actor.type == "player";
    })[0];
    this.status = this.finishDelay = null;
}

/**
 * Check if the level is finished
 * @returns {boolean}
 */
Level.prototype.isFinished = function () {
    return this.status != null && this.finishDelay < 0;
};

/**
 * Vectorize our characters
 *
 * @param x
 * @param y
 * @constructor
 */
function Vector(x, y) {
    this.x = x;
    this.y = y;
}
Vector.prototype.plus = function (other) {
    return new Vector(this.x + other.x, this.y + other.y);
};
Vector.prototype.times = function (factor) {
    return new Vector(this.x * factor, this.y * factor);
};

/**
 * Establish our characters
 *
 * @type {{@: *, o: *, =: *, |: *, v: *}}
 */
var actorChars = {
    "@": Player,
    "o": Fish,
    "=": Lava, "|": Lava, "v": Lava,
    "d": Dog
};

/**
 * Our Main character
 *
 * @param pos
 * @constructor
 */
function Player(pos) {
    this.pos = pos.plus(new Vector(0, -0.5));
    this.size = new Vector(1.5, 1.5);
    this.speed = new Vector(0, 0);
}
Player.prototype.type = "player";

/**
 * Our Lava
 *
 * @param pos
 * @param ch
 * @constructor
 */
function Lava(pos, ch) {
    this.pos = pos;
    this.size = new Vector(1, 1);
    if (ch == "=") {
        this.speed = new Vector(2, 0);
    } else if (ch == "|") {
        this.speed = new Vector(0, 2);
    } else if (ch == "v") {
        this.speed = new Vector(0, 3);
        this.repeatPos = pos;
    }
}
Lava.prototype.type = "lava";

/**
 * Our Fishes
 *
 * @param pos
 * @constructor
 */
function Fish(pos) {
    this.basePos = this.pos = pos.plus(new Vector(0.2, 0.1));
    this.size = new Vector(0.8, .5);
    this.wobble = Math.random() * Math.PI * 2;
}
Fish.prototype.type = "fish";

/**
 * Dog enemies
 *
 * @param pos
 * @constructor
 */
function Dog(pos) {
    this.pos = pos.plus(new Vector(0, -0.5));
    this.size = new Vector(1.5, 1.5);
    this.speed = new Vector(0, 0);
}
Dog.prototype.type = "dog";

/**
 * Draw our elements
 *
 * @param name
 * @param className
 * @returns {Element}
 */
function elt(name, className) {
    var elt = document.createElement(name);
    if (className) elt.className = className;
    return elt;
}

/**
 * Display our elements
 *
 * @param parent
 * @param level
 * @constructor
 */
function DOMDisplay(parent, level) {
    this.wrap = parent.appendChild(elt("div", "game"));
    this.level = level;

    this.wrap.appendChild(this.drawBackground());
    this.actorLayer = null;
    this.drawFrame();
}

var scale = 20;

/**
 * Draw our background
 *
 * @returns {Element}
 */
DOMDisplay.prototype.drawBackground = function () {
    var table = elt("table", "background");
    table.style.width = this.level.width * scale + "px";
    this.level.grid.forEach(function (row) {
        var rowElt = table.appendChild(elt("tr"));
        rowElt.style.height = scale + "px";
        row.forEach(function (type) {
            rowElt.appendChild(elt("td", type));
        });
    });
    return table;
};


/**
 * Draw the actors
 *
 * @returns {Element}
 */
DOMDisplay.prototype.drawActors = function () {
    var wrap = elt("div");
    this.level.actors.forEach(function (actor) {
        var rect = wrap.appendChild(elt("div",
            "actor " + actor.type));
        rect.style.width = actor.size.x * scale + "px";
        rect.style.height = actor.size.y * scale + "px";
        rect.style.left = actor.pos.x * scale + "px";
        rect.style.top = actor.pos.y * scale + "px";
    });
    return wrap;
};

/**
 * Draw the frame as it appears
 */
DOMDisplay.prototype.drawFrame = function () {
    if (this.actorLayer)
        this.wrap.removeChild(this.actorLayer);
    this.actorLayer = this.wrap.appendChild(this.drawActors());
    this.wrap.className = "game " + (this.level.status || "");
    this.scrollPlayerIntoView();
};

/**
 * Make sure the player stays in the viewport
 */
DOMDisplay.prototype.scrollPlayerIntoView = function () {
    var width = this.wrap.clientWidth;
    var height = this.wrap.clientHeight;
    var margin = width / 3;

    // The viewport
    var left = this.wrap.scrollLeft, right = left + width;
    var top = this.wrap.scrollTop, bottom = top + height;

    var player = this.level.player;
    var center = player.pos.plus(player.size.times(0.5))
        .times(scale);

    if (center.x < left + margin)
        this.wrap.scrollLeft = center.x - margin;
    else if (center.x > right - margin)
        this.wrap.scrollLeft = center.x + margin - width;
    if (center.y < top + margin)
        this.wrap.scrollTop = center.y - margin;
    else if (center.y > bottom - margin)
        this.wrap.scrollTop = center.y + margin - height;
};

/**
 * GC Stuff
 */
DOMDisplay.prototype.clear = function () {
    this.wrap.parentNode.removeChild(this.wrap);
};


/**
 * We need to put things into motion
 *
 * @param pos
 * @param size
 * @returns {*}
 */
Level.prototype.obstacleAt = function (pos, size) {
    var xStart = Math.floor(pos.x);
    var xEnd = Math.ceil(pos.x + size.x);
    var yStart = Math.floor(pos.y);
    var yEnd = Math.ceil(pos.y + size.y);

    if (xStart < 0 || xEnd > this.width || yStart < 0)
        return "wall";
    if (yEnd > this.height)
        return "lava";
    for (var y = yStart; y < yEnd; y++) {
        for (var x = xStart; x < xEnd; x++) {
            var fieldType = this.grid[y][x];
            if (fieldType) return fieldType;
        }
    }
};

/**
 * Find out where things are
 *
 * @param actor
 * @returns {*}
 */
Level.prototype.actorAt = function (actor) {
    for (var i = 0; i < this.actors.length; i++) {
        var other = this.actors[i];
        if (other != actor &&
            actor.pos.x + actor.size.x > other.pos.x &&
            actor.pos.x < other.pos.x + other.size.x &&
            actor.pos.y + actor.size.y > other.pos.y &&
            actor.pos.y < other.pos.y + other.size.y)
            return other;
    }
};

/**
 * Global for how man steps to take
 *
 * @type {number}
 */
var maxStep = 0.05;

/**
 * Basic animation
 *
 * @param step
 * @param keys
 */
Level.prototype.animate = function (step, keys) {
    if (this.status != null)
        this.finishDelay -= step;

    while (step > 0) {
        var thisStep = Math.min(step, maxStep);
        this.actors.forEach(function (actor) {
            actor.act(thisStep, this, keys);
        }, this);
        step -= thisStep;
    }
};

/**
 * Lava does stuff :)
 *
 * @param step
 * @param level
 */
Lava.prototype.act = function (step, level) {
    var newPos = this.pos.plus(this.speed.times(step));
    if (!level.obstacleAt(newPos, this.size))
        this.pos = newPos;
    else if (this.repeatPos)
        this.pos = this.repeatPos;
    else
        this.speed = this.speed.times(-1);
};

/**
 * Globals for wobbling
 *
 * @type {number}
 */
var wobbleSpeed = 8, wobbleDist = 0.07;

/**
 * Fish move in a wobbly sort of timey thing
 *
 * @param step
 */
Fish.prototype.act = function (step) {
    this.wobble += step * wobbleSpeed;
    var wobblePos = Math.sin(this.wobble) * wobbleDist;
    this.pos = this.basePos.plus(new Vector(0, wobblePos));
};

/**
 * Dog movements. The dog only jumps. :|
 *
 * @param step
 * @param level
 * @param keys
 */
Dog.prototype.act = function (step, level, keys) {
    // Accelerate player downward (always)
    this.speed.y += step * gravity;
    var motion = new Vector(0, this.speed.y * step);
    var newPos = this.pos.plus(motion);
    var obstacle = level.obstacleAt(newPos, this.size);
    // The floor is also an obstacle -- only allow players to
    // jump if they are touching some obstacle.
    if (obstacle) {
        level.playerTouched(obstacle);
        this.speed.y = -jumpSpeed;
        playDogJump();
    } else {
        this.pos = newPos;
    }
};

/**
 * The speed of the players x cord
 *
 * @type {number}
 */
var playerXSpeed = 7;

/**
 * The player's x movement
 *
 * @param step
 * @param level
 * @param keys
 */
Player.prototype.moveX = function (step, level, keys) {
    if (level.status !== "lost") {
        this.speed.x = 0;
        if (keys.left) this.speed.x -= playerXSpeed;
        if (keys.right) this.speed.x += playerXSpeed;

        var motion = new Vector(this.speed.x * step, 0);
        var newPos = this.pos.plus(motion);
        var obstacle = level.obstacleAt(newPos, this.size);
        if (obstacle)
            level.playerTouched(obstacle);
        else
            this.pos = newPos;
    }
};

/**
 * Gravity sucks
 *
 * @type {number}
 */
var gravity = 30;

/**
 * How high can we jump?
 *
 * @type {number}
 */
var jumpSpeed = 17;

/**
 * Y speed of the player
 *
 * @param step
 * @param level
 * @param keys
 */
Player.prototype.moveY = function (step, level, keys) {
    if (level.status !== "lost") {
        if(!keys.shift){
            this.speed.y += step * gravity;
            var motion = new Vector(0, this.speed.y * step);
            var newPos = this.pos.plus(motion);
            var obstacle = level.obstacleAt(newPos, this.size);
            if (obstacle) {
                level.playerTouched(obstacle);
                if (keys.up && this.speed.y > 0) {
                    this.speed.y = -jumpSpeed;
                    playJumpSound();
                }
                else
                    this.speed.y = 0;
            } else {
                this.pos = newPos;
            }
        } else {
            this.speed.y = 0;
        }
    }
};

/**
 * Let's move the player now
 *
 * @param step
 * @param level
 * @param keys
 */
Player.prototype.act = function (step, level, keys) {
    this.moveX(step, level, keys);
    this.moveY(step, level, keys);

    var otherActor = level.actorAt(this);
    if (otherActor)
        level.playerTouched(otherActor.type, otherActor);

    // Losing animation
    if (level.status == "lost") {
        dead = true;
        this.pos.y += step;
        this.size.y -= step;
    }
};

/**
 * Was the player touched?
 *
 * @param type
 * @param actor
 */
Level.prototype.playerTouched = function (type, actor) {
    if (type == "lava" && this.status == null) {
        this.status = "lost";
        this.finishDelay = 3;
        playDeathSound();
    } else if (type == "dog") {
        this.status = "lost";
        this.finishDelay = 3;
        playDeathSound();
    } else if (type == "fish") {
        if (isPlaying(coin)) {
            var sound = "coin.mp3";
            var audioElement = document.createElement('audio');
            audioElement.setAttribute('src', sound);
            audioElement.play();
        }
        coin.currentTime = 0;
        coin.play();
        this.actors = this.actors.filter(function (other) {
            return other != actor;
        });
        // If there aren't any coins left, player wins
        if (!this.actors.some(function (actor) {
                return actor.type == "fish";
            })) {
            this.status = "won";
            this.finishDelay = 1;
        }
    }
};

/**
 * D-Pad controls
 * todo add wasd and space
 * @type {{37: string, 38: string, 39: string}}
 */
var arrowCodes = {37: "left", 38: "up", 39: "right", 65: "left", 87: "up", 68: "right", 32: "up", 16: "shift"};

/**
 * Track the keys on the keyboard
 * todo add touch
 *
 * @param codes
 * @returns {null}
 */
function trackKeys(codes) {
    var pressed = Object.create(null);

    function handler(event) {
        if (codes.hasOwnProperty(event.keyCode)) {
            var down = event.type == "keydown";
            pressed[codes[event.keyCode]] = down;
            event.preventDefault();
        }
    }

    addEventListener("keydown", handler);
    addEventListener("keyup", handler);
    return pressed;
}

/**
 * helper method to run the animations
 *
 * @param frameFunc
 */
function runAnimation(frameFunc) {
    var lastTime = null;

    function frame(time) {
        var stop = false;
        if (lastTime != null) {
            var timeStep = Math.min(time - lastTime, 100) / 1000;
            stop = frameFunc(timeStep) === false;
        }
        lastTime = time;
        if (!stop)
            requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

/**
 * Let's use the keys that we have now and trace them
 *
 * @type {null}
 */
var arrows = trackKeys(arrowCodes);

/**
 * Using our runAnimation, we build the level run it
 *
 * @param level
 * @param Display
 * @param andThen
 */
function runLevel(level, Display, andThen) {
    var display = new Display(document.body, level);
    runAnimation(function (step) {
        level.animate(step, arrows);
        display.drawFrame(step);
        if (level.isFinished()) {
            display.clear();
            if (andThen)
                andThen(level.status);
            return false;
        }
    });
}

/**
 * Run the game (Main loop)
 *
 * @param plans
 * @param Display
 */
function runGame(plans, Display) {

    coin = document.getElementById('coin');
    death = document.getElementById('death');
    jump = document.getElementById('jump');
    dogJump = document.getElementById('dogJump');
    overworld = document.getElementById('overworld');
    winSong = document.getElementById('win');
    loseSong = document.getElementById('lose');

    function startGame(event) {
        console.log(event.keyCode);
        if (event.keyCode == 13) {
            removeEventListener("keydown", startGame);
            startLevel(0);
            var startScreen = document.getElementById("startScreen");
            startScreen.style.display = "none";
            overworld.currentTime = 0;
            overworld.play();
        }
    }

    function startClick(event) {
        removeEventListener("keydown", startGame);
        startLevel(0);
        var startScreen = document.getElementById("startScreen");
        startScreen.style.display = "none";
        overworld.currentTime = 0;
        overworld.play();
    }

    var startScreen = document.getElementById("startScreen");
    startScreen.style.display = "block";
    startScreen.addEventListener("click", startClick);

    addEventListener("keydown", startGame);

    function startLevel(n) {
        runLevel(new Level(plans[n]), Display, function (status) {
            if (status == "lost") {
                function getEnter(event) {
                    if (event.keyCode == 13) {
                        removeEventListener("keydown", getEnter);
                        var loseScreen = document.getElementById("loseScreen");
                        loseScreen.style.display = "none";
                        loseSong.pause();
                        startLevel(n);
                        overworld.currentTime = 0;
                        overworld.play();
                    }
                }

                loseSong.play();
                var loseScreen = document.getElementById("loseScreen");
                loseScreen.style.display = "block";

                addEventListener("keydown", getEnter);
            }
            else if (n < plans.length - 1) {
                startLevel(n + 1);
            }
            else {
                overworld.pause();
                console.log("You win!");
                rollCredits();
                function startOver(event) {
                    if (event.keyCode == 13) {
                        removeEventListener("keydown", startOver);
                        var canvas = document.getElementById("particles");
                        canvas.style.display = "none";
                        winSong.pause();
                        startLevel(0);
                        overworld.currentTime = 0;
                        overworld.play();
                    }
                }
                winSong.play();
                addEventListener("keydown", startOver);
            }
        });
    }
}

function isPlaying(audio) {
    return !audio.paused;
}

function playDeathSound() {
    overworld.pause();
    death.play();
}

function playJumpSound() {
    if (isPlaying(jump)) {
        var sound = "jump.mp3";
        var audioElement = document.createElement('audio');
        audioElement.setAttribute('src', sound);
        audioElement.play();
    }
    jump.play();
}

function playDogJump() {
    if (isPlaying(dogJump)) {
        var sound = "dog.mp3";
        var audioElement = document.createElement('audio');
        audioElement.setAttribute('src', sound);
        audioElement.play();
    }
    dogJump.play();
}

function rollCredits() {
    console.log("Roll credits");
    var canvas = document.getElementById("particles");
    canvas.style.display = "block";
    canvasApp();
}