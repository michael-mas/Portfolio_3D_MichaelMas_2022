import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.124/build/three.module.js';

import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.124/examples/jsm/loaders/FBXLoader.js';

//Use two type Loader create laggy problem with this environnement project
//import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/GLTFLoader.js';

import { TextGeometry } from './resources/modules/TextGeometry.js';
import { FontLoader } from './resources/modules/FontLoader.js';




//Loading constructor

const loadingManager = new THREE.LoadingManager();

// loadingManager.onStart = function(url, item, total){
//    console.log(`Started Loading: ${url}`);
// }

  const progressBar = document.getElementById('progress-bar');

    loadingManager.onProgress = function(url, loaded, total){
      progressBar.value = (loaded / total) * 100;
    }

    const progressBarContainer = document.querySelector('.progress-bar-container');
    const displayModal = document.querySelector('.modal');

  loadingManager.onLoad = function(){
    progressBarContainer.style.display = 'none';
    displayModal.style.visibility = 'visible';
  }

//  loadingManager.onError = function(url){
//      console.error(`Got problem Loading: ${url}`);
//    }




//Control character 

class BasicCharacterControllerProxy {
  constructor(animations) {
    this._animations = animations;
  }

  get animations() {
    return this._animations;
  }
};


class BasicCharacterController {
  constructor(params) {
    this._Init(params);
  }

//movements parameter

  _Init(params) {
    this._params = params;
    this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
    this._acceleration = new THREE.Vector3(1, 0.25, 50.0);
    this._velocity = new THREE.Vector3(0, 0, 0);
    this._position = new THREE.Vector3();

    this._animations = {};
    this._input = new BasicCharacterControllerInput();
    this._stateMachine = new CharacterFSM(
        new BasicCharacterControllerProxy(this._animations));

    this._LoadModels();
  }


  //Load texture of model character with fbx

  _LoadModels() {
    const loader = new FBXLoader(loadingManager);
    loader.setPath('./resources/avatar/');
    loader.load('character.fbx', (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });
      

      this._target = fbx;
      this._params.scene.add(this._target);

      this._mixer = new THREE.AnimationMixer(this._target);

      this._manager = new THREE.LoadingManager();
      this._manager.onLoad = () => {
        this._stateMachine.SetState('idle');
      };

      const _OnLoad = (animName, anim) => {
        const clip = anim.animations[0];
        const action = this._mixer.clipAction(clip);
  
        this._animations[animName] = {
          clip: clip,
          action: action,
        };
      };

//Load differents animations of character

      const loader = new FBXLoader(this._manager);
      loader.setPath('./resources/avatar/');
      loader.load('Walk.fbx', (a) => { _OnLoad('walk', a); });
      loader.load('Run.fbx', (a) => { _OnLoad('run', a); });
      loader.load('Idle.fbx', (a) => { _OnLoad('idle', a); });
      loader.load('Dance.fbx', (a) => { _OnLoad('dance', a); });
    });
  }

// Position and roration

  get Position() {
    return this._position;
  }

  get Rotation() {
    if (!this._target) {
      return new THREE.Quaternion();
    }
    return this._target.quaternion;
  }

// Uptade position

  Update(timeInSeconds) {
    if (!this._stateMachine._currentState) {
      return;
    }

    this._stateMachine.Update(timeInSeconds, this._input);

    const velocity = this._velocity;
    const frameDecceleration = new THREE.Vector3(
        velocity.x * this._decceleration.x,
        velocity.y * this._decceleration.y,
        velocity.z * this._decceleration.z
    );
    frameDecceleration.multiplyScalar(timeInSeconds);
    frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
        Math.abs(frameDecceleration.z), Math.abs(velocity.z));

    velocity.add(frameDecceleration);

    const controlObject = this._target;
    const _Q = new THREE.Quaternion();
    const _A = new THREE.Vector3();
    const _R = controlObject.quaternion.clone();

    const acc = this._acceleration.clone();
    if (this._input._keys.shift) {
      acc.multiplyScalar(2.0);
    }

    if (this._stateMachine._currentState.Name == 'dance') {
      acc.multiplyScalar(0.0);
    }

    if (this._input._keys.forward) {
      velocity.z += acc.z * timeInSeconds;
    }
    if (this._input._keys.backward) {
      velocity.z -= acc.z * timeInSeconds;
    }
    if (this._input._keys.left) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }
    if (this._input._keys.right) {
      _A.set(0, 1, 0);
      _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
      _R.multiply(_Q);
    }

    controlObject.quaternion.copy(_R);

    const oldPosition = new THREE.Vector3();
    oldPosition.copy(controlObject.position);

    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(controlObject.quaternion);
    forward.normalize();

    const sideways = new THREE.Vector3(1, 0, 0);
    sideways.applyQuaternion(controlObject.quaternion);
    sideways.normalize();

    sideways.multiplyScalar(velocity.x * timeInSeconds);
    forward.multiplyScalar(velocity.z * timeInSeconds);

    controlObject.position.add(forward);
    controlObject.position.add(sideways);

    this._position.copy(controlObject.position);

    if (this._mixer) {
      this._mixer.update(timeInSeconds);
    }
  }
};

//Make differents actions of character and keyCode of actions

class BasicCharacterControllerInput {
  constructor() {
    this._Init();    
  }

  _Init() {
    this._keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
    };
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
  }

 

  _onKeyDown(event) {
    switch (event.keyCode) {
      case 38: // up
        this._keys.forward = true;
        break;
      case 37: // left
        this._keys.left = true;
        break;
      case 40: // back
        this._keys.backward = true;
        break;
      case 39: // right
        this._keys.right = true;
        break;
      case 32: // SPACE
        this._keys.space = true;
        break;
      case 16: // SHIFT
        this._keys.shift = true;
        break;
    }
  }

  _onKeyUp(event) {
    switch(event.keyCode) {
      case 38: // up
        this._keys.forward = false;
        break;
      case 37: // left
        this._keys.left = false;
        break;
      case 40: // back
        this._keys.backward = false;
        break;
      case 39: // right
        this._keys.right = false;
        break;
      case 32: // SPACE
        this._keys.space = false;
        break;
      case 16: // SHIFT
        this._keys.shift = false;
        break;
    }
  }
};


class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null;
  }

  _AddState(name, type) {
    this._states[name] = type;
  }

  SetState(name) {
    const prevState = this._currentState;
    
    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.Exit();
    }

    const state = new this._states[name](this);

    this._currentState = state;
    state.Enter(prevState);
  }

  Update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.Update(timeElapsed, input);
    }
  }
};


class CharacterFSM extends FiniteStateMachine {
  constructor(proxy) {
    super();
    this._proxy = proxy;
    this._Init();
  }

// Parameter animation to actions movements
  _Init() {
    this._AddState('idle', IdleState);
    this._AddState('walk', WalkState);
    this._AddState('run', RunState);
    this._AddState('dance', DanceState);
  }
};


class State {
  constructor(parent) {
    this._parent = parent;
  }

  Enter() {}
  Exit() {}
  Update() {}
};

// Let's dance and loop !
class DanceState extends State {
  constructor(parent) {
    super(parent);

    this._FinishedCallback = () => {
      this._Finished();
    }
  }

  get Name() {
    return 'dance';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['dance'].action;
    const mixer = curAction.getMixer();
    mixer.addEventListener('finished', this._FinishedCallback);

    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.reset();  
      curAction.setLoop(THREE.LoopOnce, 1);
      curAction.clampWhenFinished = true;
      curAction.crossFadeFrom(prevAction, 0.2, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  _Finished() {
    this._Cleanup();
    this._parent.SetState('idle');
  }

  _Cleanup() {
    const action = this._parent._proxy._animations['dance'].action;
    
    action.getMixer().removeEventListener('finished', this._CleanupCallback);
  }

  Exit() {
    this._Cleanup();
  }

  Update(_) {
  }
};

// Let's walk

class WalkState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'walk';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['walk'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'run') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

// Let's Run

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (input._keys.shift) {
        this._parent.SetState('run');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};


class RunState extends State {
  constructor(parent) {
    super(parent);
  }

  get Name() {
    return 'run';
  }

  Enter(prevState) {
    const curAction = this._parent._proxy._animations['run'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;

      curAction.enabled = true;

      if (prevState.Name == 'walk') {
        const ratio = curAction.getClip().duration / prevAction.getClip().duration;
        curAction.time = prevAction.time * ratio;
      } else {
        curAction.time = 0.0;
        curAction.setEffectiveTimeScale(1.0);
        curAction.setEffectiveWeight(1.0);
      }

      curAction.crossFadeFrom(prevAction, 0.5, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  Exit() {
  }

  Update(timeElapsed, input) {
    if (input._keys.forward || input._keys.backward) {
      if (!input._keys.shift) {
        this._parent.SetState('walk');
      }
      return;
    }

    this._parent.SetState('idle');
  }
};


class IdleState extends State {
  constructor(parent) {
    super(parent);
  }

// Let's Idle

  get Name() {
    return 'idle';
  }

  Enter(prevState) {
    const idleAction = this._parent._proxy._animations['idle'].action;
    if (prevState) {
      const prevAction = this._parent._proxy._animations[prevState.Name].action;
      idleAction.time = 0.0;
      idleAction.enabled = true;
      idleAction.setEffectiveTimeScale(1.0);
      idleAction.setEffectiveWeight(1.0);
      idleAction.crossFadeFrom(prevAction, 0.5, true);
      idleAction.play();
    } else {
      idleAction.play();
    }
  }

  Exit() {
  }

  Update(_, input) {
    if (input._keys.forward || input._keys.backward) {
      this._parent.SetState('walk');
    } else if (input._keys.space) {
      this._parent.SetState('dance');
    }
  }
};

// Third person camera follow

class ThirdPersonCamera {
  constructor(params) {
    this._params = params;
    this._camera = params.camera;

    this._currentPosition = new THREE.Vector3();
    this._currentLookat = new THREE.Vector3();
  }

  _CalculateIdealOffset() {
    const idealOffset = new THREE.Vector3(-15, 20, -30);
    idealOffset.applyQuaternion(this._params.target.Rotation);
    idealOffset.add(this._params.target.Position);
    return idealOffset;
  }

  _CalculateIdealLookat() {
    const idealLookat = new THREE.Vector3(0, 10, 50);
    idealLookat.applyQuaternion(this._params.target.Rotation);
    idealLookat.add(this._params.target.Position);
    return idealLookat;
  }

  Update(timeElapsed) {
    const idealOffset = this._CalculateIdealOffset();
    const idealLookat = this._CalculateIdealLookat();

    // const t = 0.05;
    // const t = 4.0 * timeElapsed;
    const t = 1.0 - Math.pow(0.001, timeElapsed);

    this._currentPosition.lerp(idealOffset, t);
    this._currentLookat.lerp(idealLookat, t);

    this._camera.position.copy(this._currentPosition);
    this._camera.lookAt(this._currentLookat);
  }
}


class ThirdPersonCameraDemo {
  constructor() {
    this._Initialize();
  }

  //Initalize with WebGL in body HTML
  
  _Initialize() {
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    });
    this._threejs.outputEncoding = THREE.sRGBEncoding;
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._threejs.domElement);

    window.addEventListener('resize', () => {
      this._OnWindowResize();
    }, false);

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.position.set(25, 10, 25);

//Create scene

    this._scene = new THREE.Scene();

// Create light

    let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    light.position.set(-100, 100, 100);
    light.target.position.set(10, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 50;
    light.shadow.camera.right = -50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    this._scene.add(light);

    light = new THREE.AmbientLight(0xFFFFFF, 0.25);
    this._scene.add(light);
  


 

//Create cube and image of face of this cube for environnement

    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        './resources/environnement/posx.jpg',
        './resources/environnement/negx.jpg',
        './resources/environnement/posy2.jpg',
        './resources/environnement/negy.jpg',
        './resources/environnement/posz.jpg',
        './resources/environnement/negz.jpg',
    ]);
    texture.encoding = THREE.sRGBEncoding;
    this._scene.background = texture;

 // Create grid overlay on plane
 var grid = new THREE.GridHelper(1000, 20, 0x000000, 0x000000);
 grid.material.opacity = 0.5;
 grid.material.transparent = true;
 grid.position.y = 0.005;
 this._scene.add(grid);

//Easter Egg

    // Moon Majora's Mask

    const moonTexture = new THREE.TextureLoader().load('resources/images/moon.jpg');


    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(12, 128, 128),
      new THREE.MeshBasicMaterial({
        map: moonTexture,
      })
    );
    moon.position.set(85, 80, 220);
    moon.rotateY(Math.PI/1.5);
    this._scene.add(moon);

  //TEST

  const geometry = new THREE.BoxGeometry( 10, 10, 10 );
  const material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
  const cube = new THREE.Mesh( geometry, material );
  cube.position.set(52, 7, 53);
  this._scene.add( cube );

//Cubix Mod :)

    // My Language Cube

    const mikaTexture = new THREE.TextureLoader().load('./resources/textures/photo.png');

    const mika = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 1), new THREE.MeshBasicMaterial({ map: mikaTexture }));
    mika.position.set(-15, 20, 100);
    this._scene.add(mika);

    //Border Language Cube

    const boxtexture = new THREE.TextureLoader().load('./resources/textures/metal.png');

    const borderbox = new THREE.Mesh(new THREE.BoxGeometry(33, 33, 2), new THREE.MeshBasicMaterial({ map: boxtexture }));
    borderbox.position.set(-15, 20, 100.6);
    this._scene.add(borderbox);

    //Cube desktop

    const woodTexture = new THREE.TextureLoader().load('./resources/textures/woodTexture.jpg');

    const desktop = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 15), new THREE.MeshBasicMaterial({ map: woodTexture }));
    desktop.position.set(-52, 7, 53);
    this._scene.add(desktop);

    


    //Cube Screen desktop

    const screenofdeath = new THREE.TextureLoader().load('./resources/textures/screenofdeath.png');

    const screen = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 1), new THREE.MeshBasicMaterial({ map: screenofdeath }));
    screen.position.set(-48.05, 18, 53.52);
    screen.rotateY(0.19);
    screen.rotateX(0.1);
    this._scene.add(screen);

// TEXT

// MICHAEL MAS TEXT

const fontLoader = new FontLoader
fontLoader.load('./resources/fonts/Rubik_Light_Regular.json',(droidFont)=>{
  const textGeometry = new TextGeometry('MICHAEL MAS', {
    height:2,
    size: 10,
    font: droidFont,
  });
  const textMaterial = new THREE.MeshNormalMaterial();
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.position.set(25, 50, 100);
  //textMesh.rotateX(Math.PI/6);
  textMesh.rotateY(Math.PI/1);
  this._scene.add(textMesh);
});

//DEVELOPPER FULL STACK TEXT

const fontLoader2 = new FontLoader
fontLoader2.load('./resources/fonts/Rubik_Light_Regular.json',(droidFont)=>{
  const textGeometry = new TextGeometry('DEVELOPPEUR FULL STACK', {
    height:2,
    size: 5,
    font: droidFont,
  });
  const textMaterial = new THREE.MeshBasicMaterial({
    color: 0x930404
});
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.position.set(25, 40, 100);
  //textMesh.rotateX(Math.PI/6);
  textMesh.rotateY(Math.PI/1);
  this._scene.add(textMesh);
});

 
 // Create plane (ground)

    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(1000, 1000, 10, 10),
        new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25,
          }));
    plane.castShadow = false;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    this._scene.add(plane);

    this._mixers = [];
    this._previousRAF = null;

    this._LoadAnimatedModel();

//Animated model

    //Fitness zombie

    this._LoadAnimatedModelAndPlay(
      './resources/zombie/', 'mremireh_o_desbiens.fbx', 'run.fbx', new THREE.Vector3(50, 2, 100));

    //Dev Bot

    this._LoadAnimatedModelAndPlay4(
      './resources/3dmodel/', 'Entering Code.fbx', 'Entering Code.fbx', new THREE.Vector3(-50, 2, 40));
  


//static model 
    
    //Rolls carpet

    this._LoadAnimatedModelAndPlay2(
      './resources/3dmodel/', 'Treadmill FBX.fbx', 'Treadmill FBX.fbx', new THREE.Vector3(50, 1, 100));


    // Computer

    this._LoadAnimatedModelAndPlay3(
      './resources/3dmodel/', 'Computer Monitor OLD.fbx', 'Computer Monitor OLD.fbx', new THREE.Vector3(-52, 13.2, 50));

    this._RAF();
  }



// Function animated model

  //Zombie
  _LoadAnimatedModelAndPlay(path, modelFile, animFile, offset) {
    const loader = new FBXLoader();
    loader.setPath(path);
    loader.load(modelFile, (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });
      //console.log(fbx);
      fbx.position.copy(offset);
      fbx.rotateY(Math.PI/2);

      const anim = new FBXLoader();
      anim.setPath(path);
      anim.load(animFile, (anim) => {
        const m = new THREE.AnimationMixer(fbx);
        this._mixers.push(m);
        const idle = m.clipAction(anim.animations[0]);
        idle.play();
      });
      
      this._scene.add(fbx);
    });
  }

  //Rolls carpet

  _LoadAnimatedModelAndPlay2(path, modelFile, animFile, offset) {
    const loader = new FBXLoader();
    loader.setPath(path);
    loader.load(modelFile, (fbx) => {
      fbx.scale.setScalar(1);
      fbx.traverse(c => {
        c.castShadow = true;
      });
      //console.log(fbx);
      fbx.position.copy(offset);
      fbx.rotateY(Math.PI/1);

      const anim = new FBXLoader();
      anim.setPath(path);
     
      
      this._scene.add(fbx);
    });
  }

  //Computer

  _LoadAnimatedModelAndPlay3(path, modelFile, animFile, offset) {
    const loader = new FBXLoader();
    loader.setPath(path);
    loader.load(modelFile, (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });
      //console.log(fbx);
      fbx.position.copy(offset);
      fbx.rotateY(Math.PI/1);

      const anim = new FBXLoader();
      anim.setPath(path);
      
      this._scene.add(fbx);
    });
  }

  //Dev bot

  _LoadAnimatedModelAndPlay4(path, modelFile, animFile, offset) {
    const loader = new FBXLoader();
    loader.setPath(path);
    loader.load(modelFile, (fbx) => {
      fbx.scale.setScalar(0.1);
      fbx.traverse(c => {
        c.castShadow = true;
      });
      //console.log(fbx);
      fbx.position.copy(offset);
      //fbx.rotateY(Math.PI/1);

      const anim = new FBXLoader();
      anim.setPath(path);
      anim.load(animFile, (anim) => {
        const m = new THREE.AnimationMixer(fbx);
        this._mixers.push(m);
        const idle = m.clipAction(anim.animations[0]);
        idle.play();
      });
      
      this._scene.add(fbx);
    });
  }


  
  //Function animated control character
  _LoadAnimatedModel() {
    const params = {
      camera: this._camera,
      scene: this._scene,
    }
    this._controls = new BasicCharacterController(params);

    this._thirdPersonCamera = new ThirdPersonCamera({
      camera: this._camera,
      target: this._controls,
    });
  }


  // Resize screen 

  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  //Let's animated

  _RAF() {
    requestAnimationFrame((t) => {
      if (this._previousRAF === null) {
        this._previousRAF = t;
      }
      this._RAF();

      this._threejs.render(this._scene, this._camera);
      this._Step(t - this._previousRAF);
      this._previousRAF = t;
    });
  }

  

  _Step(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (this._mixers) {
      this._mixers.map(m => m.update(timeElapsedS));
    }

    if (this._controls) {
      this._controls.Update(timeElapsedS);
    }

    this._thirdPersonCamera.Update(timeElapsedS);
  }
}


let _APP = null;

//Inject to DOM

window.addEventListener('DOMContentLoaded', () => {
  _APP = new ThirdPersonCameraDemo();
});


function _LerpOverFrames(frames, t) {
  const s = new THREE.Vector3(0, 0, 0);
  const e = new THREE.Vector3(100, 0, 0);
  const c = s.clone();

  for (let i = 0; i < frames; i++) {
    c.lerp(e, t);
  }
  return c;
}

function _TestLerp(t1, t2) {
  const v1 = _LerpOverFrames(100, t1);
  const v2 = _LerpOverFrames(50, t2);
  console.log(v1.x + ' | ' + v2.x);
}

_TestLerp(0.01, 0.01);
_TestLerp(1.0 / 100.0, 1.0 / 50.0);
_TestLerp(1.0 - Math.pow(0.3, 1.0 / 100.0), 
          1.0 - Math.pow(0.3, 1.0 / 50.0));

