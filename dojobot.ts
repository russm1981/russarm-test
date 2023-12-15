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
        LED1R = 2,
        LED1G = 9,
        LED1B = 8,
        LED2R = 10,
        LED2G = 11,
        LED2B = 12,
        LED3R = 14,
        LED3G = 13,
        LED3B = 15
    }

    //PCA9685 PWM chip hardware config
    const PWM_ADDRESS = 0x40
    
    //PCA9685 PWM chip register locations
    const PWM_REG_PRESCALE = 0xFE       //the prescale register address
    const PWM_REG_MODE1 = 0x00          // MODE1
    const PWM_REG_MODE2 = 0x01          // MODE2

    const PWM_REG_CH0_ON_L = 0x06       // Channel 0 output and brightness control ON byte 0
    const PWM_REG_CH0_ON_H = 0x07       // Channel 0 output and brightness control ON byte 1
    const PWM_REG_CH0_OFF_L = 0x08      // Channel 0 output and brightness control OFF byte 2
    const PWM_REG_CH0_OFF_H = 0x09      // Channel 0 output and brightness control OFF byte 3

    const PWM_REG_ALL_ON_L = 0xFA       // All channels output and brightness control ON byte 0
    const PWM_REG_ALL_ON_H = 0xFB       // All channels output and brightness control ON byte 1
    const PWM_REG_ALL_OFF_L = 0xFC      // All channels output and brightness control OFF byte 2
    const PWM_REG_ALL_OFF_H = 0xFD      // All channels output and brightness control OFF byte 3
    
    //Default values for chip settings

    /*Mode1
        Bit7 = restart on
        Bit6 = ext clk on
        Bit5 = auto increment on
        Bit4 = sleep on
        Bit3 = respond to subaddr1
        Bit2 = respond to subaddr2
        Bit1 = respond to subaddr3
        Bit0 = respond to an all call
    */
    const pwm_mode1_default = 0x01
    const pwm_mode1_sleep = mode1_default | 0x10; // Set sleep bit to 1
    const pwm_mode1_wake = mode1_default & 0xEF; // Set sleep bit to 0
    const pwm_mode1_restart = mode1_wake | 0x80; // Set restart bit to 1

    /*Mode2
        Bit7 to 5 reserved
        Bit4 = invert output logic
        Bit3 = change outputs on I2C ACK  (off = change on STOP)
        Bit2 = set outputs to totem pole (off = open-drain)
        Bit1 and 0: output behaviour in case of OE pin = 1
            00: output = 0
            01: output = 1 when totem pole, or high impedance when open-drain
            10: output = high-impedance
    */
    const pwm_mode2_default = 0x04    //open-drain, change outputs on Ack

    /*Prescaler and timing
        Determines frequencies at which outputs modulate
        Minimum value is 3

        prescale = (osc_clock / (4096 * update rate)) - 1

        update_rate is the frequency required (200Hz default)
        servos recommended 40-200hz, but most use 50hz

        internal oscillator is 25mhz
        therefore 50hz update rate:
        prescale = 121d = 79h
        
    */
    const pwm_prescale_servo = 0x79   //50hz for servo
    const pwm_prescale_LED = 0x1D     //200hz for LEDs

    /*Output ON and OFF control registers

        Each PWM cycle is 4096 long
        The ON register sets the count (time) for rising edge to HIGH, to allow stagger to avoid current draw
        The OFF register sets the count (time) for falling edge to LOW
        
        Example
        We want rising edge delayed to 10% within cycle
        We want HIGH period to be 20%   (so LOW period is 80%) 
        10% = 410d counts = 19Ah (in hex).  Reduce by 1 as counter ends at 4095 -> Rising edge @ 199h
        20% = 819d counts
        Off time = 410 + 819 - 1 = 1228 -> Falling edge @ 4CCh
        Set ON_H = 01h, ON_L = 99h, OFF_H = 04h, OFF_L = ChipConfig
        
        Notes on delays
        Should stagger LED start times, but servos can all be at 0
        Falling edge can occur "before" rising edge if delay is such that it wraps into next cycle

        Exceptions
        Setting Bit4 in ON_H register to 1 sets the output to permanently ON
        Setting Bit4 in OFF_H register to 1 sets the output to permanently OFF
    */
    //Output always on
    pwm_output_always_on_l = 0
    pwm_output_always_on_h = 0x10
    pwm_output_always_off_l = 0
    pwm_output_always_off_h = 0
    //Output always off
    pwm_output_never_on_l = 0
    pwm_output_never_on_h = 0
    pwm_output_never_off_l = 0
    pwm_output_never_off_h = 0x10
 
    function write(register: number, value: number): void {
        const buffer = pins.createBuffer(2)
        buffer[0] = register
        buffer[1] = value
        pins.i2cWriteBuffer(PWM_ADDRESS, buffer, false)
    } 

    export function setDebug(debugEnabled: boolean): void {
        _DEBUG = debugEnabled
    }

    //DOJO:BOT SPECIFIC CODE

    /**
    * Initialise servos on DojoBot (and centre)
    * No parameters, uses default values
    */
    //% block
    export function bot_init(): void {
        debug(`Init chip at address 0x40, 50Hz update rate`)
        const buf = pins.createBuffer(2)
        
        write(PWM_REG_MODE1, pwm_mode1_sleep)

        write(PWM_REG_PRESCALE, pwm_prescale_servo)

        //Set all outputs to zero
        write(PWM_REG_ALL_ON_L, 0x00)
        write(PWM_REG_ALL_ON_H, 0x00)
        write(PWM_REG_ALL_OFF_L, 0x00)
        write(PWM_REG_ALL_OFF_H, 0x00)

        write(PWM_REG_MODE1, mode1_wake)

        //1000us (1ms) delay (allows oscillator to stabilise, min 500us)
        control.waitMicros(1000)
        write(PWM_REG_MODE1, mode1_restart)
    }
    
    /**
    * Set a servo on DojoBot to a value
    * @param n describe parameter here, eg: 5
    * @param s describe parameter here, eg: "Hello"
    * @param e describe pa ameter here
    */
    //% block
    export function bot_servo(ser_id: number, degrees: number): void {
        // Setup for standard, 180degree servo
        // Generate a pulse between 1ms and 2ms with 1.5ms being 90 degrees
        // 0 degrees = 1ms, 180 degrees = 2ms

        //Rising edge always at 0
        on_time = 0
        //Check position within bounds
        degrees = Math.max(0, Math.min(180, degrees))
        //Falling edge at 1ms to 2ms
        //50Hz, so 20ms is one set of 4095 counts
        //1ms = 4095 / 20 -> equivalent to 180 degrees 
        //1 degree = 4095 / (20 * 180) = 4095 / 3600      
        off_time = ((position * 4095) / 3600) + 205     //205 adds 1ms at end
        //Write that to appropriate servo based on id
        ser_id = Math.max(0, Math.min(180, ser_id))
        
        const buffer = pins.createBuffer(2)
        const pinOffset = 4 * ser_id
        on_time = Math.max(0, Math.min(4095, on_time))
        off_time = Math.max(0, Math.min(4095, off_time))

        debug(`setServo(${pinNumber}, ${on_time}, ${off_time}, 0x40)`)
        debug(`  pinOffset ${pinOffset}`)

        // Low byte of onStep
        write(pinOffset + PWM_REG_CH0_ON_L, on_time & 0xFF)

        // High byte of onStep
        write(pinOffset + PWM_REG_CH0_ON_H, (on_time >> 8) & 0x0F)

        // Low byte of offStep
        write(pinOffset + PWM_REG_CH0_OFF_L, off_time & 0xFF)

        // High byte of offStep
        write(pinOffset + PWM_REG_CH0_OFF_H, (off_time >> 8) & 0x0F)
    }

    /**
    * Control the LEDs on DojoBot, with individual RGB values
    * @param value describe value here, eg: 5
    */
    //% block
    export function bot_led(led_num: number, red: number, green: number, blue: number): void {
        // If colour is set, then control it 
        // If colour is 0 then turn it Off
        // If colour is -1 then ignore it
        // Set LED ID to start with
        switch(led_num) {
            case 1:
                red_num = LED1R
                grn_num = LED1G
                blu_num = LED1B
                break
            case 2:
                red_num = LED2R
                grn_num = LED2G
                blu_num = LED2B
                break
            case 3:
                red_num = LED3R
                grn_num = LED3G
                blu_num = LED3B
                break
            default:
                debug(`bot_led - invalid LED value`)
                return
        }
        //Calculate PWM value
        //colour is a value from 0 to 255
        pinOffset = 4 * red_num
        switch(red) {
            case -1:
                //Don't do anything for RED
                break
            case 0:
                //Turn RED off
                write(pinOffset + PWM_REG_CH0_ON_L, pwm_output_never_on_l)
                write(pinOffset + PWM_REG_CH0_ON_H, pwm_output_never_on_h)
                write(pinOffset + PWM_REG_CH0_OFF_L, pwm_output_never_off_l)
                write(pinOffset + PWM_REG_CH0_OFF_H, pwm_output_never_off_h)
                break
            case 255:
                //Turn RED fully on
                write(pinOffset + PWM_REG_CH0_ON_L, pwm_output_always_on_l)
                write(pinOffset + PWM_REG_CH0_ON_H, pwm_output_always_on_h)
                write(pinOffset + PWM_REG_CH0_OFF_L, pwm_output_always_off_l)
                write(pinOffset + PWM_REG_CH0_OFF_H, pwm_output_always_off_h)
                break
            default:
                //Set RED value
                red = Math.max(0, Math.min(255, red))
                red_val_on = 0
                red_val_off = (red * 4095) / 255
                write(pinOffset + PWM_REG_CH0_ON_L, 0)
                write(pinOffset + PWM_REG_CH0_ON_H, 0)
                write(pinOffset + PWM_REG_CH0_OFF_L, red_val_off & 0xFF)
                write(pinOffset + PWM_REG_CH0_OFF_H, (red_val_off >> 8) & 0x0F)
        }
        
        pinOffset = 4 * grn_num
        switch (green) {
            case -1:
                //Don't do anything for GRN
                break
            case 0:
                //Turn GRN off
                write(pinOffset + PWM_REG_CH0_ON_L, pwm_output_never_on_l)
                write(pinOffset + PWM_REG_CH0_ON_H, pwm_output_never_on_h)
                write(pinOffset + PWM_REG_CH0_OFF_L, pwm_output_never_off_l)
                write(pinOffset + PWM_REG_CH0_OFF_H, pwm_output_never_off_h)
                break
            case 255:
                //Turn GRN fully on
                write(pinOffset + PWM_REG_CH0_ON_L, pwm_output_always_on_l)
                write(pinOffset + PWM_REG_CH0_ON_H, pwm_output_always_on_h)
                write(pinOffset + PWM_REG_CH0_OFF_L, pwm_output_always_off_l)
                write(pinOffset + PWM_REG_CH0_OFF_H, pwm_output_always_off_h)
                break
            default:
                //Set GRN value
                green = Math.max(0, Math.min(255, green))
                grn_val_on = 0
                grn_val_off = (green * 4095) / 255
                write(pinOffset + PWM_REG_CH0_ON_L, 0)
                write(pinOffset + PWM_REG_CH0_ON_H, 0)
                write(pinOffset + PWM_REG_CH0_OFF_L, grn_val_off & 0xFF)
                write(pinOffset + PWM_REG_CH0_OFF_H, (grn_val_off >> 8) & 0x0F)
        }

        pinOffset = 4 * blu_num
        switch (blue) {
            case -1:
                //Don't do anything for BLUE
                break
            case 0:
                //Turn BLUE off
                write(pinOffset + PWM_REG_CH0_ON_L, pwm_output_never_on_l)
                write(pinOffset + PWM_REG_CH0_ON_H, pwm_output_never_on_h)
                write(pinOffset + PWM_REG_CH0_OFF_L, pwm_output_never_off_l)
                write(pinOffset + PWM_REG_CH0_OFF_H, pwm_output_never_off_h)
                break
            case 255:
                //Turn BLUE fully on
                write(pinOffset + PWM_REG_CH0_ON_L, pwm_output_always_on_l)
                write(pinOffset + PWM_REG_CH0_ON_H, pwm_output_always_on_h)
                write(pinOffset + PWM_REG_CH0_OFF_L, pwm_output_always_off_l)
                write(pinOffset + PWM_REG_CH0_OFF_H, pwm_output_always_off_h)
                break
            default:
                //Set BLUE value
                blue = Math.max(0, Math.min(255, blue))
                blu_val_on = 0
                blu_val_off = (blue * 4095) / 255
                write(pinOffset + PWM_REG_CH0_ON_L, 0)
                write(pinOffset + PWM_REG_CH0_ON_H, 0)
                write(pinOffset + PWM_REG_CH0_OFF_L, blu_val_off & 0xFF)
                write(pinOffset + PWM_REG_CH0_OFF_H, (blu_val_off >> 8) & 0x0F)
        }
    }

    /**
    * Control the LEDs on DojoBot, with single colour
    * @param value describe value here, eg: 5
    */
    //% block
    export function bot_led_colour(led_num: number, colour: number): void {
        // Call bot_led and pass individual colours
        // colour = 0xRRGGBB in hex
        red = (colour >> 16) & 0xFF
        green = (colour >> 8) & 0xFF
        blue = colour & 0xFF
        bot_led(led_num, red, green, blue)
    }

    

    /**
    * Control the relay (for electromagnet)
    * @param value describe value here, eg: 5
    */
    //% block
    export function bot_relay(value: number): void {
        // Add code
    }

    /**
    * Read joystick, slider or control knob value
    * @param value describe value here, eg: 5
    */
    //% block
    export function bot_input(id: number): number {
        // Add code
        return 0
    }

    /**
    * Read time
    * @param value describe value here, eg: 5
    */
    //% block
    export function bot_gettime(): string {
        // Add code
        return "Empty"
    }

    /**
    * Set time
    * @param value describe value here, eg: 5
    */
    //% block
    export function bot_settime(year: number, month: number, day: number, hour: number, minute: number, second: number): void {
        // Add code
        
    }

    /**
    * Read the version of the dojobot board
    * @param value describe value here, eg: 5
    */
    //% block
    export function bot_version(): number {
        // Add code
        return 1
    }

    /**
    * Set the status light on the PCB
    * @param value describe value here, eg: 5
    */
    //% block
    export function bot_status(value: number): void {
        // Add code
        
    }

    /**
    * Read the values of the buttons on the dojo PCB
    * @param value describe value here, eg: 5
    */
    //% block
    export function bot_buttons(): number {
        // Add code
        return 0
    }
}