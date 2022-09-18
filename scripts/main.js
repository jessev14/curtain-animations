const moduleID = 'curtain-animations';
let socket;

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
});


Hooks.once('socketlib.ready', () => {
    socket = socketlib.registerModule(moduleID);
    socket.register('runAnimation', runAnimation);
});


Hooks.on('getSceneControlButtons', controls => {
    const tokenControls = controls.find(c => c.name === 'token');
    tokenControls.tools.push({
        icon: 'fa-solid fa-booth-curtain',
        name: 'curtain',
        title: `${moduleID}.CurtainAnimation`,
        visible: game.user.isGM,
        button: true,
        onClick: curtainAnimationCreateDialog
    });
});


function pushAnimation({img, text, animationType} = {}) {
    socket.executeForEveryone('runAnimation', { img, text, animationType });
}

async function runAnimation({ img, text, animationType } = {}) {
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

const curtainAnimationCreateDialog = async () => {
    const title = localize('dialog.title');
    const content = await renderTemplate(`modules/${moduleID}/templates/create-dialog.hbs`);
    let text, img, cb;
    new Dialog({
        title,
        content,
        buttons: {
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
        },
        close: async ([html]) => {
            const textInput = html.querySelector('input[name="text"]');
            text = textInput.value || textInput.placeholder;

            const imageInput = html.querySelector('input[name="img.src"]');
            img = imageInput.value || `modules/${moduleID}/images/sun.png`;

            if (cb === 'run') {
                return socket.executeForEveryone('runAnimation', { text, img });
            } else if (cb === 'save') {
                const macro = await Macro.create({
                    name: localize('CurtainAnimation'),
                    type: 'script',
                    scope: 'global',
                    command: `const text = '${text}';
                    const img = '${img}';
                    return game.modules.get('${moduleID}').api.pushAnimation({ text, img });
                    `
                });
                return macro.sheet.render(true);
            }

        },
        render: ([html]) => {
            html.querySelector('button.file-picker').addEventListener('click', function() {
                new FilePicker({
                    type: 'imagevideo',
                    callback: path => html.querySelector('input[name="img.src"]').value = path
                }).render(true);
            })
        }
    }).render(true);
}
