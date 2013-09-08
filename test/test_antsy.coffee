should = require 'should'
util = require 'util'

antsy = require "../src/antsy"

WHITE_ON_BLACK = "\u001b[48;5;0m\u001b[38;5;15m"
WHITE_ON_BLUE = "\u001b[48;5;12m\u001b[38;5;15m"
RESET = "\u001b[0m"

describe "antsy", ->
  it "has a top-level API", ->
    c = new antsy.Canvas(4, 3)
    c.at(0, 1).backgroundColor("blue").color("#fff").write("BLUE")
    c.toStrings().should.eql [
      "#{WHITE_ON_BLACK}    #{RESET}"
      "#{WHITE_ON_BLUE}BLUE#{RESET}"
      "#{WHITE_ON_BLACK}    #{RESET}"
    ]
    antsy.get_color("white").should.eql(15)
