const moduleID = 'curtain-animations';
let socket;

const log = x => console.log(x);

const localize = key => game.i18n.localize(`${moduleID}.${key}`);

const delay = async (duration, log = null) => {
    await new Promise(resolve => {
        setTimeout(() => {
            if (log) console.log(log);
            resolve();
        }, duration);
    });
}


Hooks.once('init', () => {
    game.modules.get(moduleID).api = {
        pushAnimation
    };

    game.settings.register(moduleID, 'macroWarningDisabled', {
        name: `${moduleID}.settings.macroWarningDisabled.name`,
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });
});

Hooks.once('socketlib.ready', () => {
    socket = socketlib.registerModule(moduleID);
    socket.register('runAnimation', runAnimation);
});


Hooks.on('getSceneControlButtons', controls => {
    const lightingControls = controls.find(c => c.name === 'lighting');
    lightingControls.tools.push({
        icon: 'fa-solid fa-booth-curtain',
        name: 'curtain',
        title: `${moduleID}.CurtainAnimation`,
        visible: game.user.isGM,
        button: true,
        onClick: curtainAnimationCreateDialog
    });
});

// Use socketlib to execute curtain animation on all clients
function pushAnimation({img, text, animationType, newSceneData } = {}) {
    socket.executeForEveryone('runAnimation', { img, text, animationType, newSceneData });
}

// Curtain animation
async function runAnimation({ img, text, animationType, newSceneData } = {}) {
    // Create curtain and add to document
    const curtain = document.createElement('div');
    curtain.classList.add(`${moduleID}-curtain`);
    document.body.append(curtain);

    // Drop curtain
    let interval, stopInterval = false;;
    let curtainCounter = 0;
    await new Promise(resolve => {
        interval = setInterval(() => {
            dropRaiseCurtain();
            if (curtainCounter >= 200) resolve();
        }, 100);
    });

    // If new scene data present, update scene while curtain is dropped
    if (newSceneData) await canvas.scene.update(newSceneData);


    await delay(1000);


    // Add text to curtain
    const textEl = document.createElement('div');
    textEl.classList.add(`${moduleID}-text`);
    textEl.innerText = text;
    curtain.appendChild(textEl);

    // Add image to curtain
    const image = document.createElement('img');
    image.classList.add(`${moduleID}-image`);
    image.src = img;
    image.style.height = '200px';
    image.style.width = '200px';
    curtain.appendChild(image);

    // Fade in text and image
    stopInterval = false;
    await new Promise(resolve => {
        interval = setInterval(() => {
            fadeInOut();
            if (stopInterval) resolve();
        }, 100);
    });


    await delay(1000);


    // Animate image
    image.style.transition = 'left 3s ease-in-out';
    image.style.left = '80vw';


    await delay(5000);


    // Fade out text and image
    stopInterval = false;
    await new Promise(resolve => {
        interval = setInterval(() => {
            fadeInOut(false);
            if (stopInterval) resolve();
        }, 100);
    });

    // Raise curtain
    await new Promise(resolve => {
        interval = setInterval(() => {
            dropRaiseCurtain(false);
            if (curtainCounter <= 0) resolve();
        }, 100);
    });


    await delay(1000);


    // Remove curtain from canvas
    curtain.remove();


    function dropRaiseCurtain(drop = true) {
        let pos, alpha;
        if (curtainCounter <= 100) {
            // delta pos
            pos = curtainCounter;
            alpha = 0;

        } else {
            // delta alpha
            pos = 100;
            alpha = (curtainCounter - 100) / 100;
        }

        curtain.style.background = `linear-gradient(180deg, rgb(0, 0, 0, 1) 0%, rgb(0, 0, 0, ${alpha}) ${pos}%)`;
        if (drop) curtainCounter += 10;
        else curtainCounter -= 10;

        const stop = drop
            ? alpha > 1
            : alpha < 0;
        if (stop) stopIntervalFn();
    }

    function fadeInOut(fadeIn = true) {
        const currentOpacity = parseFloat(getComputedStyle(textEl).opacity);
        const newOpacity = currentOpacity + (fadeIn ? 0.1 : -0.1);
        textEl.style.opacity = newOpacity;
        image.style.opacity = newOpacity;

        const stop = fadeIn
            ? newOpacity > 1
            : newOpacity < 0;
        if (stop) stopIntervalFn();
    }

    function stopIntervalFn() {
        clearInterval(interval);
        stopInterval = true;
    }
}

// UI dialog to set animation parameters
const curtainAnimationCreateDialog = async () => {
    let text, img, cb;
    const content = await renderTemplate(`modules/${moduleID}/templates/create-dialog.hbs`);
    const buttons = {
        play: {
            icon: '<i class="fa-solid fa-play"></i>',
            label: localize('dialog.play'),
            callback: () => cb = 'run'
        },
        save: {
            icon: '<i class="fa-solid fa-floppy-disk"></i>',
            label: localize('dialog.save'),
            callback: () => cb = 'save'
        }
    };
    const dialog = new Dialog({
        title: localize('dialog.title'),
        content,
        buttons,
        close: async ([html]) => {
            const textInput = html.querySelector('input[name="text"]');
            text = textInput.value || textInput.placeholder;

            const imageInput = html.querySelector('input[name="img.src"]');
            img = imageInput.value || `modules/${moduleID}/images/sun.png`;

            const newSceneData = dialog.newSceneData;

            if (cb === 'run') return socket.executeForEveryone('runAnimation', { text, img, newSceneData });
            else if (cb === 'save') {

                if (newSceneData && !game.settings.get(moduleID, 'macroWarningDisabled')) {
                    await Dialog.prompt({
                        title: game.i18n.localize('Warning'),
                        content: localize('dialog.warning')
                    });
                }

                const macro = await Macro.create({
                    name: `${localize('CurtainAnimation')} - ${canvas.scene.name}`,
                    type: 'script',
                    scope: 'global',
                    command: `const text = '${text}';
                    const img = '${img}';
                    const newSceneData = ${JSON.stringify(newSceneData)};
                    return game.modules.get('${moduleID}').api.pushAnimation({ text, img, newSceneData });
                    `
                });
                
                return macro.sheet.render(true);
            }

        },
        render: ([html]) => {
            const button = html.querySelector('button.file-picker');
            const fp = FilePicker.fromButton(button);
            fp.button.addEventListener('click', () => fp.render(true));

            html.querySelector('button[data-action="advanced-settings"]').addEventListener('click', () => {
                advancedCurtainAnimationDialog(dialog, html);
            });
        }
    }).render(true);

    async function advancedCurtainAnimationDialog(parentDialog, html) {
        Hooks.once('renderSceneConfig', (app, [html], appData) => {
            const submitButton = html.querySelector('button[type="submit"]');
            submitButton.type = 'button';
            submitButton.addEventListener('click', async function() {
                parentDialog.newSceneData = app._getSubmitData();
                await app.close();
            });
        });
        canvas.scene.sheet.render(true);
    }
}
