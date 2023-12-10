/*
DojoBot Functions
*/



/**
* Custom blocks
*/
//% block="DojoBot" weight=100 color=#0fbc11 icon=""
namespace dojobot {

    let _DEBUG: boolean = false
    const debug = (msg: string) => {
        if (_DEBUG === true) {
            serial.writeLine(msg)
        }
    }

    //Configure user constants to match hardware

    export enum LED_ID {
        LED1 = 1,
        LED2 = 2,
        LED3 = 3
    }

    export enum SERVO_ID {
        SERVO_LEFT = 6,
        SERVO_RIGHT = 0,
        SERVO_ROTATE = 1,
        SERVO_JAW1 = 5,
        SERVO_JAW2 = 4
    }

    enum LEDColour {
        LED1R = 1,
        LED1G = 1,
        LED1B = 1,
        LED2R = 1,
        LED2G = 1,
        LED2B = 1,
        LED3R = 1,
        LED3G = 1,
        LED3B = 1
    }

    //Hardware config

    const CHIP_ADDRESS = 0x40
    //const MIN_CHIP_ADDRESS = 0x40
    //const MAX_CHIP_ADDRESS = MIN_CHIP_ADDRESS + 62
    const chipResolution = 4096;
    const PrescaleReg = 0xFE //the prescale register address
    const modeRegister1 = 0x00 // MODE1
    const modeRegister1Default = 0x01
    const modeRegister2 = 0x01 // MODE2
    const modeRegister2Default = 0x04
    const sleep = modeRegister1Default | 0x10; // Set sleep bit to 1
    const wake = modeRegister1Default & 0xEF; // Set sleep bit to 0
    const restart = wake | 0x80; // Set restart bit to 1
    //const allChannelsOnStepLowByte = 0xFA // ALL_LED_ON_L
    //const allChannelsOnStepHighByte = 0xFB // ALL_LED_ON_H
    //const allChannelsOffStepLowByte = 0xFC // ALL_LED_OFF_L
    //const allChannelsOffStepHighByte = 0xFD // ALL_LED_OFF_H
    const PinRegDistance = 4
    //const channel0OnStepLowByte = 0x06 // LED0_ON_L
    //const channel0OnStepHighByte = 0x07 // LED0_ON_H
    //const channel0OffStepLowByte = 0x08 // LED0_OFF_L
    //const channel0OffStepHighByte = 0x09 // LED0_OFF_H

    //Setup Hex Constants

    const hexChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f']

    //Add class for servo configuration and the defaults

    export class ServoConfigObject {
        id: number;
        pinNumber: number;
        minOffset: number;
        midOffset: number;
        maxOffset: number;
        position: number;
    }

    export const DefaultServoConfig = new ServoConfigObject();
    DefaultServoConfig.pinNumber = -1
    DefaultServoConfig.minOffset = 5
    DefaultServoConfig.midOffset = 15
    DefaultServoConfig.maxOffset = 25
    DefaultServoConfig.position = 90

    //Class to configure servos

    export class ServoConfig {
        id: number;
        pinNumber: number;
        minOffset: number;
        midOffset: number;
        maxOffset: number;
        position: number;
        constructor(id: number, config: ServoConfigObject) {
            this.id = id
            this.init(config)
        }

        init(config: ServoConfigObject) {
            this.pinNumber = config.pinNumber > -1 ? config.pinNumber : this.id - 1
            this.setOffsetsFromFreq(config.minOffset, config.maxOffset, config.midOffset)
            this.position = -1
        }

        debug() {
            const params = this.config()

            for (let j = 0; j < params.length; j = j + 2) {
                debug(`Servo[${this.id}].${params[j]}: ${params[j + 1]}`)
            }
        }

        setOffsetsFromFreq(startFreq: number, stopFreq: number, midFreq: number = -1): void {
            this.minOffset = startFreq // calcFreqOffset(startFreq)
            this.maxOffset = stopFreq // calcFreqOffset(stopFreq)
            this.midOffset = midFreq > -1 ? midFreq : ((stopFreq - startFreq) / 2) + startFreq
        }

        config(): string[] {
            return [
                'id', this.id.toString(),
                'pinNumber', this.pinNumber.toString(),
                'minOffset', this.minOffset.toString(),
                'maxOffset', this.maxOffset.toString(),
                'position', this.position.toString(),
            ]
        }
    }

    export class ChipConfig {
        address: number;
        servos: ServoConfig[];
        freq: number;
        constructor(address: number = 0x40, freq: number = 50) {
            this.address = address
            this.servos = [
                new ServoConfig(1, DefaultServoConfig),
                new ServoConfig(2, DefaultServoConfig),
                new ServoConfig(3, DefaultServoConfig),
                new ServoConfig(4, DefaultServoConfig),
                new ServoConfig(5, DefaultServoConfig),
                new ServoConfig(6, DefaultServoConfig),
                new ServoConfig(7, DefaultServoConfig),
                new ServoConfig(8, DefaultServoConfig),
                new ServoConfig(9, DefaultServoConfig),
                new ServoConfig(10, DefaultServoConfig),
                new ServoConfig(11, DefaultServoConfig),
                new ServoConfig(12, DefaultServoConfig),
                new ServoConfig(13, DefaultServoConfig),
                new ServoConfig(14, DefaultServoConfig),
                new ServoConfig(15, DefaultServoConfig),
                new ServoConfig(16, DefaultServoConfig)
            ]
            this.freq = freq
            init(address, freq)
        }
    }

    export const chips: ChipConfig[] = []

    function calcFreqPrescaler(freq: number): number {
        return (25000000 / (freq * chipResolution)) - 1;
    }

    function write(chipAddress: number, register: number, value: number): void {
        const buffer = pins.createBuffer(2)
        buffer[0] = register
        buffer[1] = value
        pins.i2cWriteBuffer(chipAddress, buffer, false)
    }

    export function getChipConfig(address: number): ChipConfig {
        for (let i = 0; i < chips.length; i++) {
            if (chips[i].address === address) {
                debug(`Returning chip ${i}`)
                return chips[i]
            }
        }
        debug(`Creating new chip for address ${address}`)
        const chip = new ChipConfig(address)
        const index = chips.length
        chips.push(chip)
        return chips[index]
    }

    function calcFreqOffset(freq: number, offset: number) {
        return ((offset * 1000) / (1000 / freq) * chipResolution) / 10000
    }

    /**
     * Used to set the pulse range (0-4095) of a given pin on the PCA9685
     * @param chipAddress [64-125] The I2C address of your PCA9685; eg: 64
     * @param pinNumber The pin number (0-15) to set the pulse range on
     * @param onStep The range offset (0-4095) to turn the signal on
     * @param offStep The range offset (0-4095) to turn the signal off
     */
    //% block advanced=true
    export function setPinPulseRange(pinNumber: PinNum = 0, onStep: number = 0, offStep: number = 2048, chipAddress: number = 0x40): void {
        pinNumber = Math.max(0, Math.min(15, pinNumber))
        const buffer = pins.createBuffer(2)
        const pinOffset = PinRegDistance * pinNumber
        onStep = Math.max(0, Math.min(4095, onStep))
        offStep = Math.max(0, Math.min(4095, offStep))

        debug(`setPinPulseRange(${pinNumber}, ${onStep}, ${offStep}, ${chipAddress})`)
        debug(`  pinOffset ${pinOffset}`)

        // Low byte of onStep
        write(chipAddress, pinOffset + channel0OnStepLowByte, onStep & 0xFF)

        // High byte of onStep
        write(chipAddress, pinOffset + channel0OnStepHighByte, (onStep >> 8) & 0x0F)

        // Low byte of offStep
        write(chipAddress, pinOffset + channel0OffStepLowByte, offStep & 0xFF)

        // High byte of offStep
        write(chipAddress, pinOffset + channel0OffStepHighByte, (offStep >> 8) & 0x0F)
    }

    /**
     * Used to set the duty cycle (0-100) of a given led connected to the PCA9685
     * @param chipAddress [64-125] The I2C address of your PCA9685; eg: 64
     * @param ledNumber The number (1-16) of the LED to set the duty cycle on
     * @param dutyCycle The duty cycle (0-100) to set the LED to
     */
    //% block
    export function setLedDutyCycle(ledNum: LEDNum = 1, dutyCycle: number, chipAddress: number = 0x40): void {
        ledNum = Math.max(1, Math.min(16, ledNum))
        dutyCycle = Math.max(0, Math.min(100, dutyCycle))
        const pwm = (dutyCycle * (chipResolution - 1)) / 100
        debug(`setLedDutyCycle(${ledNum}, ${dutyCycle}, ${chipAddress})`)
        return setPinPulseRange(ledNum - 1, 0, pwm, chipAddress)
    }

    function degrees180ToPWM(freq: number, degrees: number, offsetStart: number, offsetEnd: number): number {
        // Calculate the offset of the off point in the freq
        offsetEnd = calcFreqOffset(freq, offsetEnd)
        offsetStart = calcFreqOffset(freq, offsetStart)
        const spread: number = offsetEnd - offsetStart
        const calcOffset: number = ((degrees * spread) / 180) + offsetStart
        // Clamp it to the bounds
        return Math.max(offsetStart, Math.min(offsetEnd, calcOffset))
    }

    /**
     * Used to move the given servo to the specified degrees (0-180) connected to the PCA9685
     * @param chipAddress [64-125] The I2C address of your PCA9685; eg: 64
     * @param servoNum The number (1-16) of the servo to move
     * @param degrees The degrees (0-180) to move the servo to
     */
    //% block
    export function setServoPosition(servoNum: ServoNum = 1, degrees: number, chipAddress: number = 0x40): void {
        const chip = getChipConfig(chipAddress)
        servoNum = Math.max(1, Math.min(16, servoNum))
        degrees = Math.max(0, Math.min(180, degrees))
        const servo: ServoConfig = chip.servos[servoNum - 1]
        const pwm = degrees180ToPWM(chip.freq, degrees, servo.minOffset, servo.maxOffset)
        servo.position = degrees
        debug(`setServoPosition(${servoNum}, ${degrees}, ${chipAddress})`)
        debug(`  servo.pinNumber ${servo.pinNumber}`)
        debug(`  servo.minOffset ${servo.minOffset}`)
        debug(`  servo.maxOffset ${servo.maxOffset}`)
        debug(`  pwm ${pwm}`)
        servo.debug()
        return setPinPulseRange(servo.pinNumber, 0, pwm, chipAddress)
    }

    /**
     * Used to set the rotation speed of a continous rotation servo from -100% to 100%
     * @param chipAddress [64-125] The I2C address of your PCA9685; eg: 64
     * @param servoNum The number (1-16) of the servo to move
     * @param speed [-100-100] The speed (-100-100) to turn the servo at
     */
    //% block
    export function setCRServoPosition(servoNum: ServoNum = 1, speed: number, chipAddress: number = 0x40): void {
        debug(`setCRServoPosition(${servoNum}, ${speed}, ${chipAddress})`)
        const chip = getChipConfig(chipAddress)
        const freq = chip.freq
        servoNum = Math.max(1, Math.min(16, servoNum))
        const servo: ServoConfig = chip.servos[servoNum - 1]
        const offsetStart = calcFreqOffset(freq, servo.minOffset)
        const offsetMid = calcFreqOffset(freq, servo.midOffset)
        const offsetEnd = calcFreqOffset(freq, servo.maxOffset)
        if (speed === 0) {
            return setPinPulseRange(servo.pinNumber, 0, offsetMid, chipAddress)
        }
        const isReverse: boolean = speed < 0
        debug(isReverse ? 'Reverse' : 'Forward')
        const spread = isReverse ? offsetMid - offsetStart : offsetEnd - offsetMid
        debug(`Spread ${spread}`)
        servo.position = speed
        speed = Math.abs(speed)
        const calcOffset: number = ((speed * spread) / 100)
        debug(`Offset ${calcOffset}`)
        debug(`min ${offsetStart}`)
        debug(`mid ${offsetMid}`)
        debug(`max ${offsetEnd}`)
        const pwm = isReverse ? offsetMid - calcOffset : offsetMid + calcOffset
        debug(`pwm ${pwm}`)
        return setPinPulseRange(servo.pinNumber, 0, pwm, chipAddress)
    }

    /**
     * Used to set the range in centiseconds (milliseconds * 10) for the pulse width to control the connected servo
     * @param chipAddress [64-125] The I2C address of your PCA9685; eg: 64
     * @param servoNum The number (1-16) of the servo to move; eg: 1
     * @param minTimeCs The minimum centiseconds (0-1000) to turn the servo on; eg: 5
     * @param maxTimeCs The maximum centiseconds (0-1000) to leave the servo on for; eg: 25
     * @param midTimeCs The mid (90 degree for regular or off position if continuous rotation) for the servo; eg: 15
     */
    //% block advanced=true
    export function setServoLimits(servoNum: ServoNum = 1, minTimeCs: number = 5, maxTimeCs: number = 2.5, midTimeCs: number = -1, chipAddress: number = 0x40): void {
        const chip = getChipConfig(chipAddress)
        servoNum = Math.max(1, Math.min(16, servoNum))
        minTimeCs = Math.max(0, minTimeCs)
        maxTimeCs = Math.max(0, maxTimeCs)
        debug(`setServoLimits(${servoNum}, ${minTimeCs}, ${maxTimeCs}, ${chipAddress})`)
        const servo: ServoConfig = chip.servos[servoNum - 1]
        midTimeCs = midTimeCs > -1 ? midTimeCs : ((maxTimeCs - minTimeCs) / 2) + minTimeCs
        debug(`midTimeCs ${midTimeCs}`)
        return servo.setOffsetsFromFreq(minTimeCs, maxTimeCs, midTimeCs)
    }

    /**
     * Used to setup the chip, will cause the chip to do a full reset and turn off all outputs.
     * @param chipAddress [64-125] The I2C address of your PCA9685; eg: 64
     * @param freq [40-1000] Frequency (40-1000) in hertz to run the clock cycle at; eg: 50
     */
    //% block advanced=true
    export function init(chipAddress: number = 0x40, newFreq: number = 50) {
        debug(`Init chip at address ${chipAddress} to ${newFreq}Hz`)
        const buf = pins.createBuffer(2)
        const freq = (newFreq > 1000 ? 1000 : (newFreq < 40 ? 40 : newFreq))
        const prescaler = calcFreqPrescaler(freq)

        write(chipAddress, modeRegister1, sleep)

        write(chipAddress, PrescaleReg, prescaler)

        write(chipAddress, allChannelsOnStepLowByte, 0x00)
        write(chipAddress, allChannelsOnStepHighByte, 0x00)
        write(chipAddress, allChannelsOffStepLowByte, 0x00)
        write(chipAddress, allChannelsOffStepHighByte, 0x00)

        write(chipAddress, modeRegister1, wake)

        control.waitMicros(1000)
        write(chipAddress, modeRegister1, restart)
    }

    /**
     * Used to reset the chip, will cause the chip to do a full reset and turn off all outputs.
     * @param chipAddress [64-125] The I2C address of your PCA9685; eg: 64
     */
    //% block
    export function reset(chipAddress: number = 0x40): void {
        return init(chipAddress, getChipConfig(chipAddress).freq);
    }

    /**
     * Used to reset the chip, will cause the chip to do a full reset and turn off all outputs.
     * @param hexAddress The hex address to convert to decimal; eg: 0x40
     */
    //% block
    export function chipAddress(hexAddress: string): number {
        hexAddress = stripHexPrefix(hexAddress)
        let dec = 0
        let lastidx = 0
        let lastchar = 0
        const l = Math.min(2, hexAddress.length)
        for (let i = 0; i < l; i++) {
            const char = hexAddress.charAt(i)
            const idx = hexChars.indexOf(char)
            const pos = l - i - 1
            lastidx = pos
            dec = dec + (idx * Math.pow(16, pos))
        }
        return dec
    }

    export function setDebug(debugEnabled: boolean): void {
        _DEBUG = debugEnabled
    }

    //RUSS SPECIFIC CODE

    /**
    * Initialise servos on DojoBot (and centre)
    * @param n describe parameter here, eg: 5
    * @param s describe parameter here, eg: "Hello"
    * @param e describe parameter here
    */
    //% block
    export function servo_init(): void {
        // Add code here
    }
    
    /**
    * Set a servo on DojoBot to a value
    * @param n describe parameter here, eg: 5
    * @param s describe parameter here, eg: "Hello"
    * @param e describe parameter here
    */
    //% block
    export function servo_set(id: number, value: number): void {
        // Add code here
    }

    /**
    * Centre a servo on DojoBot 
    * @param n describe parameter here, eg: 5
    * @param s describe parameter here, eg: "Hello"
    * @param e describe parameter here
    */
    //% block
    export function servo_centre(id: number): void {
        // Add code here
    }

    /**
    * Control the LEDs on DojoBot, with individual RGB values
    * @param value describe value here, eg: 5
    */
    //% block
    export function led_rgb(led: number, red: number, green: number, blue: number): void {
        // Add code
    }

    /**
    * Control the LEDs on DojoBot, with single colour
    * @param value describe value here, eg: 5
    */
    //% block
    export function led_colour(led: number, colour: number): void {
        // Add code
    }

    /**
    * Control the LEDs on DojoBot, with individual RGB values
    * @param value describe value here, eg: 5
    */
    //% block
    export function led_on(led: number): void {
        // Add code
    }

    /**
    * Control the LEDs on DojoBot, with single colour
    * @param value describe value here, eg: 5
    */
    //% block
    export function led_off(led: number): void {
        // Add code
    }

    /**
    * Turn the electromagnet on
    * @param value describe value here, eg: 5
    */
    //% block
    export function mag_on(led: number): void {
        // Add code
    }

    /**
    * Turn the electromagnet off
    * @param value describe value here, eg: 5
    */
    //% block
    export function mag_off(led: number): void {
        // Add code
    }

    /**
    * Read joystick, slider or control knob value
    * @param value describe value here, eg: 5
    */
    //% block
    export function input_read(id: number): number {
        // Add code
        return 0
    }

    /**
    * Read time
    * @param value describe value here, eg: 5
    */
    //% block
    export function time_read(): string {
        // Add code
        return "Empty"
    }

    /**
    * Set time
    * @param value describe value here, eg: 5
    */
    //% block
    export function time_set(year: number, month: number, day: number, hour: number, minute: number, second: number): string {
        // Add code
        return "Empty"
    }

    /**
    * Read the version of the dojobot board
    * @param value describe value here, eg: 5
    */
    //% block
    export function read_ver(): number {
        // Add code
        return 1
    }

    /**
    * Set the status light on the PCB
    * @param value describe value here, eg: 5
    */
    //% block
    export function status_set(value: number): {
        // Add code
        
    }

    /**
    * Read the values of the buttons on the dojo PCB
    * @param value describe value here, eg: 5
    */
    //% block
    export function buttons_read(): number {
        // Add code
        return 0
    }
}