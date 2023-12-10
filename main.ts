basic.showIcon(IconNames.Happy)
basic.forever(function on_forever() {
    let peeled = false;
    if (dojobot.pick(TropicalFruit.Banana)) {
        peeled = dojobot.peel(TropicalFruit.Banana);
    }
})
