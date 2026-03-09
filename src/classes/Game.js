/**
 * Base Game class,
 * - loads in all assets
 * - loads Player and player actions/anims
 * - creates Map, sets camera/world bounds
 * - creates Exits and generates items (game manager)
 */

import Phaser from 'phaser';
import gameConfig from '../config/game-config';
import Map from '../classes/Map';
import ObjectLoader from '../classes/ObjectLoader';
import Player from '../sprites/Player';
import ImageLoader from '../classes/ImageLoader';
import BoxManager from '../classes/Box/BoxManager';

export default class Game extends Phaser.Scene {
  constructor() {
    super( 'Game' );
  }

  init() {
    // console.log( gameConfig );

    // containers
    this._ANIMS = {
      pressedCursor: 'down', // keeps track of what cursor was pressed previously
      actionAnimation: '', // stores action animation to play on SPACE press
    };

    this._BTNS = {};
    this._INPUTS = {};
    this._MAP = {};
    this._MODAL = {};
    this._PLAYER = {};
    this._SPRITES = {};
    this._UTILITY = {};
  }

  preload() {
    new ImageLoader( this );

 this.load.audio('cow', 'audio/cow.ogg');
  this.load.audio('chicken', 'audio/chicken.ogg');
  this.load.audio('bird', 'audio/bird.ogg');

  }

  create() {
    const mapVars = gameConfig.map[gameConfig.loadedScene];

    // create map
    this._MAP = new Map({
      scene: this,
      key: mapVars.key,
      imgKey: mapVars.imgKey,
      tileSetName: mapVars.tileSetName,
      bgLayerName: 'background', // all tilesets have a "background" layer
      blockedLayerName: 'blocked' // similarly, they all have "blocked"
    });

    // world bounds
    this.physics.world.bounds.width = mapVars.mapBounds.width;
    this.physics.world.bounds.height = mapVars.mapBounds.height;

    // based on previous map ( gameConfig.previousData.scene ), determine appropriate x/y value and frame
    const playerCoords = this.setPlayerCoords();
    const playerFrame = this.setPlayerDirection();

    // create Jack
    this._PLAYER = new Player({
      scene: this,
      x: playerCoords.x,
      y: playerCoords.y,
      key: 'jack-standing',
      frame: playerFrame
    });

    // limit camera to size of map
    this.cameras.main.setBounds( 0, 0, mapVars.mapBounds.width, mapVars.mapBounds.height );
    this.cameras.main.startFollow( this._PLAYER ); // camera follows player

    // enable cursor keys
    this._INPUTS = this.input.keyboard.createCursorKeys();

    // assign additional keys
    this._INPUTS.enter = this.input.keyboard.addKey( 13 );
    this._INPUTS.escape = this.input.keyboard.addKey( 27 );

    this.createObjectLoader();  // generate items
    this.createEventListeners();  // event listeners

    // handles modal box for tasks and status
    this._UTILITY.boxManager = new BoxManager( this );

    this.setupMemoryGame();

}

  
  // update loop
  update( time, delta ) {
    // if ( gameConfig.taskMenuOpen ) {
    //   gameConfig.pauseUpdateLoop = true;
    // } else {
    //   gameConfig.pauseUpdateLoop = false;
    // }

    // do walking anims if not paused
    if ( ! gameConfig.pauseUpdateLoop ) {
      this.animation_update_loop();
    }

    // if there is an overlap sprite stored, check if overlapping
    if ( gameConfig.overlapData.isActive && Object.keys( gameConfig.overlapData.sprite ).length !== 0 ) {
      let isOverlapping = Phaser.Geom.Intersects.RectangleToRectangle( this._PLAYER.getBounds(), gameConfig.overlapData.overlap.getBounds() );

      if ( isOverlapping ) {
        gameConfig.overlapData.isActive = true;
      } else {
        gameConfig.overlapData.isActive = false;
        gameConfig.overlapData.sprite = {};
      }
    }


  }
  setupMemoryGame() {
    this.animals = ['cow', 'chicken', 'bird'];
    this.correctSequence = [];
    this.playerSequence = [];
    this.memoryGameStarted = false;
    this.sequenceIsPlaying = false;
    this.roundCompleted = false;
    this.activeDialog = null;

    for ( let i = 0; i < 3; i++ ) {
      const animal = Phaser.Utils.Array.GetRandom( this.animals );
      this.correctSequence.push( animal );
    }

    this.setupAnimalClickHandlers();
    this.showMemoryDialog();
    this.playSequence();
  }

  setupAnimalClickHandlers() {
    Object.values( this._SPRITES ).forEach( sprite => {
      if ( sprite.creatureType !== 'animal' ) {
        return;
      }

      sprite.setInteractive( { useHandCursor: true } );
      sprite.on( 'pointerdown', () => {
        this.handleAnimalClick( sprite );
      } );
    } );
  }

  getAnimalTypeFromSprite( sprite ) {
    if ( sprite.name.includes( 'cow' ) ) {
      return 'cow';
    }

    if ( sprite.name.includes( 'chicken' ) || sprite.name.includes( 'chick' ) ) {
      return 'chicken';
    }

    if ( sprite.name.includes( 'bird' ) ) {
      return 'bird';
    }

    return null;
  }

  handleAnimalClick( sprite ) {
    if ( !this.memoryGameStarted || this.sequenceIsPlaying || this.roundCompleted ) {
      return;
    }

    const clickedAnimal = this.getAnimalTypeFromSprite( sprite );
    if ( !clickedAnimal ) {
      return;
    }

    this.playerSequence.push( clickedAnimal );

    const currentIndex = this.playerSequence.length - 1;
    const expectedAnimal = this.correctSequence[currentIndex];

    if ( clickedAnimal !== expectedAnimal ) {
      this.playerSequence = [];
      this.showMemoryStatus( 'Ops! Essa não é a ordem correta. Ouça novamente e tente outra vez.' );
      this.playSequence();
      return;
    }

    sprite.disableInteractive();
    sprite.setVisible( false );
    if ( sprite.body ) {
      sprite.body.enable = false;
    }
    if ( sprite.overlap && sprite.overlap.body ) {
      sprite.overlap.body.enable = false;
      sprite.overlap.setVisible( false );
    }

    if ( this.playerSequence.length === this.correctSequence.length ) {
      this.roundCompleted = true;
      this.showMemoryStatus( 'Parabéns! Você acertou a sequência dos animais!' );
      return;
    }

    this.showMemoryStatus( 'Muito bem! Agora encontre o próximo animal da sequência.' );
  }

  playSequence( index = 0 ) {
    if ( index === 0 ) {
      this.sequenceIsPlaying = true;
      this.memoryGameStarted = false;
    }

    if ( index >= this.correctSequence.length ) {
      this.sequenceIsPlaying = false;
      this.showStartButton();
      return;
    }

    const animal = this.correctSequence[index];
    this.sound.play( animal );

    this.time.delayedCall( 1500, () => {
      this.playSequence( index + 1 );
    } );
  }

  showMemoryDialog() {
    const dialogWidth = 660;
    const dialogHeight = 170;

    const dialogBg = this.add.rectangle(
      this.scale.width / 2,
      100,
      dialogWidth,
      dialogHeight,
      0x000000,
      0.85
    )
      .setScrollFactor( 0 )
      .setDepth( 1000 );

    const dialogText = this.add.text(
      this.scale.width / 2,
      70,
      'Ouça os sons e encontre os animais na ordem correta!',
      {
        font: '22px monospace',
        fill: '#ffffff',
        align: 'center',
        wordWrap: { width: dialogWidth - 40 }
      }
    )
      .setOrigin( 0.5 )
      .setScrollFactor( 0 )
      .setDepth( 1001 );

    const statusText = this.add.text(
      this.scale.width / 2,
      105,
      'Memorize a sequência de sons.',
      {
        font: '18px monospace',
        fill: '#ffd166',
        align: 'center'
      }
    )
      .setOrigin( 0.5 )
      .setScrollFactor( 0 )
      .setDepth( 1001 );

    this.activeDialog = {
      dialogBg,
      dialogText,
      statusText,
      startBtnBg: null,
      startBtnText: null
    };
  }

  showStartButton() {
    if ( this.roundCompleted || !this.activeDialog || this.activeDialog.startBtnBg ) {
      return;
    }

    const startBtnBg = this.add.rectangle( this.scale.width / 2, 145, 140, 40, 0x1d6f42 )
      .setScrollFactor( 0 )
      .setDepth( 1001 )
      .setInteractive( { useHandCursor: true } );

    const startBtnText = this.add.text( this.scale.width / 2, 145, 'Iniciar', {
      font: '20px monospace',
      fill: '#ffffff'
    } )
      .setOrigin( 0.5 )
      .setScrollFactor( 0 )
      .setDepth( 1002 );

    startBtnBg.on( 'pointerdown', () => {
      this.memoryGameStarted = true;
      this.showMemoryStatus( 'Clique nos animais na ordem dos sons.' );
      startBtnBg.destroy();
      startBtnText.destroy();
      this.activeDialog.startBtnBg = null;
      this.activeDialog.startBtnText = null;
    } );

    this.activeDialog.startBtnBg = startBtnBg;
    this.activeDialog.startBtnText = startBtnText;
    this.showMemoryStatus( 'Agora clique em Iniciar para tentar.' );
  }

  showMemoryStatus( message ) {
    if ( this.activeDialog && this.activeDialog.statusText ) {
      this.activeDialog.statusText.setText( message );
    }
  }

  // plays animation of passed key
  playAnim( animKey ) {
    if( ! this._PLAYER.anims.isPlaying || this._PLAYER.anims.currentAnim.key !== animKey ) {
      this._PLAYER.anims.play( animKey );
    }
  }

  // animation update loop
  animation_update_loop() {
    if ( this._INPUTS.down.isDown ) {
      this._PLAYER.body.setVelocityY( gameConfig.playerSpeed );
      this._PLAYER.body.setVelocityX( 0 );
      this._ANIMS.pressedCursor = 'down';
      this.playAnim( 'walking-down' );
    }
    else if ( this._INPUTS.up.isDown ) {
      this._PLAYER.body.setVelocityY(-gameConfig.playerSpeed );
      this._PLAYER.body.setVelocityX( 0 );
      this._ANIMS.pressedCursor = 'up';
      this.playAnim( 'walking-up' );
    }
    else if ( this._INPUTS.left.isDown ) {
      this._PLAYER.body.setVelocityX( -gameConfig.playerSpeed );
      this._PLAYER.body.setVelocityY( 0 );
      this._ANIMS.pressedCursor = 'left';
      this.playAnim( 'walking-left' );
    }
    else if ( this._INPUTS.right.isDown ) {
      this._PLAYER.body.setVelocityX( gameConfig.playerSpeed );
      this._PLAYER.body.setVelocityY( 0 );
      this._ANIMS.pressedCursor = 'right';
      this.playAnim( 'walking-right' );
    }
    else {
      this.stopPlayerAnim();
    }
  }

  // stops animation & velocity on player
  stopPlayerAnim() {
    this._PLAYER.body.setVelocityY( 0 );
    this._PLAYER.body.setVelocityX( 0 );
    this._PLAYER.anims.stop();
  }

  // manages chicken/item generation
  createObjectLoader() {
    this._UTILITY.ObjectLoader = new ObjectLoader( {
      scene: this,
      objectLayers: this._MAP.tilemap.objects
    } );
    this._UTILITY.ObjectLoader.setup();
  }

  createEventListeners() {
    // keyboard events
    this.input.keyboard.on( 'keydown', function() {

      // on ENTER, open dialog box for animals/person/point-of-interest
      if ( this._INPUTS.enter.isDown && gameConfig.overlapData.isActive ) {
        // console.log(gameConfig);
        this._UTILITY.boxManager.createBox( 'dialog' );
      }

      // on SHIFT, display Animal Status / Active Tasks buttons
      else if ( this._INPUTS.shift.isDown ) {
        this._UTILITY.boxManager.createBox( 'tasks' );
      }

      // ESC closes open dialog box
      else if ( this._INPUTS.escape.isDown ) {
        this._UTILITY.boxManager.hideBox();
      }

      // if SPACE bar is pressed, play stored Action animation
      else if ( this._INPUTS.space.isDown ) {
        gameConfig.pauseUpdateLoop = true;
        this.stopPlayerAnim();

        switch( this._ANIMS.pressedCursor ) {
          case 'down':
            this.playAnim( 'ring-cowbell-down' );
            break;
          case 'up':
            this.playAnim( 'ring-cowbell-up' );
            break;
          case 'left':
            this.playAnim( 'ring-cowbell-left' );
            break;
          case 'right':
            this.playAnim( 'ring-cowbell-right' );
            break;
          default:
            this._PLAYER.setTexture( 'jack-standing', 0 );
        }
      }

      // after SPACE bar pressed, restart update loop
      else if ( this._INPUTS.space.isUp ) {
        gameConfig.pauseUpdateLoop = false;
      }

      else {
        // gameConfig.pauseUpdateLoop = false;
      }

    }.bind( this ) );

    // on animation complete, sets standing texture
    this._PLAYER.on( 'animationcomplete', ( animation, frame ) => {
      switch( this._ANIMS.pressedCursor ) {
        case 'down':
          this._PLAYER.setTexture( 'jack-standing', 0 );
          break;
        case 'up':
          this._PLAYER.setTexture( 'jack-standing', 1 );
          break;
        case 'left':
          this._PLAYER.setTexture( 'jack-standing', 2 );
          break;
        case 'right':
          this._PLAYER.setTexture( 'jack-standing', 3 );
          break;
        default:
          this._PLAYER.setTexture( 'jack-standing', 0 );
      }
    }, this );

  }

  // returns frame for player's Standing sprite
  setPlayerDirection() {
    switch( gameConfig.previousData.direction ) {
      case 'down':
        return 0;
      case 'up':
        return 1;
      case 'left':
        return 2;
      case 'right':
        return 3;
      default:
        return 0;
    }
  }

  // returns player's loading X/Y coords, based on previous Scene
  setPlayerCoords() {
    const prevScene = gameConfig.previousData.scene;
    const playerCoords = gameConfig.map[ gameConfig.loadedScene ].playerStartPos;

    if ( prevScene.length > 0 && Object.keys( playerCoords ).length > 1 ) {
      return playerCoords[ prevScene ];
    } else {
      // else, no previous scene exists
      return playerCoords.default;
    }
  }

}
