kitronik_simple_servo.set_servo_angle(kitronik_simple_servo.ServoChoice.SERVO1, 90)
kitronik_simple_servo.set_servo_angle(kitronik_simple_servo.ServoChoice.SERVO2, 90)
kitronik_simple_servo.set_servo_angle(kitronik_simple_servo.ServoChoice.SERVO3, 90)

def on_forever():
    pass
basic.forever(on_forever)
