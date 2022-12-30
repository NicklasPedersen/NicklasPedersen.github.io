
const RAMSize = 64 * 1024;
const WORD_SIZE = 2;
const TOTAL_WORDS = RAMSize / WORD_SIZE;
const ADDRESS_MASK = TOTAL_WORDS - 1;

let ram = new Uint16Array(TOTAL_WORDS);
let pc = 0;
let registers = new Uint16Array(8);

let buffer = new Uint16Array(10);
let read_p = 0;
let write_p = 0;
let need_input = false;

let outputs = [];

function has_input() {
    return read_p != write_p
}

function needs_input_to_continue() {
    return !has_input() && need_input
}

function read_buf() {
    let value = buffer[read_p];
    read_p = (read_p + 1) % 10;
    return value;
}

function write_buff(value) {
    buffer[write_p] = value;
    write_p = (write_p + 1) % 10;
}

function write_output_buff(value) {
    outputs += value;
}

function read(address) {
    if (address & 1) {
        throw new Error(`Unaligned read to address ${address.toString(16)}`)
    }
    return ram[(address >> 1) & ADDRESS_MASK];
}

function write(address, value) {
    if (address & 1) {
        throw new Error(`Unaligned write to address ${address.toString(16)}`)
    }
    ram[(address >> 1) & ADDRESS_MASK] = value;
}

function write_reg(reg, val) {
    if (!reg) {
        return;
    }

    registers[reg] = val;
}

function take_bits(value, bit, amt) {
    let bit_mask = (1 << amt) - 1;
    return (value >> bit) & bit_mask;
}

function sign_ext(value, sbit) {
    let sign = (value >> sbit) & 1;
    
    // 00100000
    // s = 1
    // sbit = 5
    let sign_mask = (sign << (16 - sbit)) - sign;
    // 1000
    // 111
    sign_mask = sign_mask << sbit;
    return value | sign_mask;
}

let halting = true;

function decode_instr(instr_value) {
    let opcode = take_bits(instr_value, 13, 3)
    let regA = take_bits(instr_value, 10, 3);
    let regB = take_bits(instr_value, 7, 3);
    let regC = take_bits(instr_value, 0, 3);

    let always_zero = take_bits(instr_value, 3, 4);
    let signed_imm = sign_ext(take_bits(instr_value, 0, 7), 6);
    let usigned_imm = take_bits(instr_value, 0, 10);

    if (opcode == 0b011) {
        return {
            "instr": "lui",
            "reg_a": regA,
            "imm": usigned_imm
        }
    } else if ((0b101 & ~opcode) == 0b101) {
        if (always_zero != 0) {
            throw new Error("RRI instr should have zero");
        }
        let instr = (opcode & 0b010) ? "nand" : "add";        
        return {
            "instr": instr,
            "reg_a": regA,
            "reg_b": regB,
            "reg_c": regC
        }
    } else {
        let instr;
        if (opcode == 0b111) {
            if (signed_imm != 0) {
                console.info("jalr has non-zero imm, could be hlt");
            }
            instr = "jalr";
        } else if (opcode == 0b001) {
            instr = "addi";
        } else if (opcode == 0b101) {
            instr = "sw";
        } else if (opcode == 0b100) {
            instr = "lw";
        } else {
            instr = "beq";
        }
        return {
            "instr": instr,
            "reg_a": regA,
            "reg_b": regB,
            "s_imm": signed_imm
        }
    }
}

function tick() {
    let next_pc = pc + WORD_SIZE;
    let instr_value = read(pc);
    let instr = decode_instr(instr_value);
    console.log(pc)

    switch (instr.instr) {
    case "add":
        write_reg(instr.reg_a, registers[instr.reg_b] + registers[instr.reg_c]);
        break;
    case "nand":
        write_reg(instr.reg_a, ~(registers[instr.reg_b] & registers[instr.reg_c]));
        break;
    case "lui":
        write_reg(instr.reg_a, (instr.imm << 6) & 0xFFC0);
        break;
    case "addi":
        write_reg(instr.reg_a, registers[instr.reg_b] + instr.s_imm);
        break;
    case "sw":
        let sw_address = registers[instr.reg_b] + instr.s_imm;
        if (sw_address == 0) {
            write_output_buff(registers[instr.reg_a]);
            update_ios();
        } else {
            write(registers[instr.reg_b] + instr.s_imm, registers[instr.reg_a]);
        }
        break;
    case "lw":
        let address = registers[instr.reg_b] + instr.s_imm;
        let value;
        if (address == 0) {
            if (!has_input()) {
                need_input = true;
                return;
            }
            value = read_buf();
            need_input = false;
            update_ios();
        } else {
            value = read(address);
        }
        write_reg(instr.reg_a, value);
        break;
    case "beq":
        if (registers[instr.reg_a] == registers[instr.reg_b]) {
            next_pc += instr.s_imm;
        }
        break;
    case "jalr":
        if (instr.s_imm) {
            halting = true;
        } else {
            console.warn("Jalr not implemented")
        }
        break;

    }

    pc = (next_pc & ADDRESS_MASK);
}

function add(regA, regB, regC) {
    return (0b000 << 13) | (regA << 10) | (regB << 7) | regC;
}

function nand(regA, regB, regC) {
    return (0b010 << 13) | (regA << 10) | (regB << 7) | regC;
}

function addi(regA, regB, imm) {
    if (imm > 63 || imm < -64) {
        throw new Error("addi imm too large or small");
    }
    return (0b001 << 13) | (regA << 10) | (regB << 7) | (imm & 0x7F);
}

function lui(regA, imm) {
    if (imm > 4095 || imm < -2048) {
        throw new Error("lui imm too large or small");
    }
}

function sw(regA, regB, imm) {
    if (imm > 63 || imm < -64) {
        throw new Error("sw imm too large or small");
    }
    return (0b101 << 13) | (regA << 10) | (regB << 7) | (imm & 0x7F);
}

function lw(regA, regB, imm) {
    if (imm > 63 || imm < -64) {
        throw new Error("lw imm too large or small");
    }
    return (0b100 << 13) | (regA << 10) | (regB << 7) | (imm & 0x7F);

}

function beq(regA, regB, imm) {
    if (imm > 63 || imm < -64) {
        throw new Error("beq imm too large or small");
    }
    return (0b110 << 13) | (regA << 10) | (regB << 7) | (imm & 0x7F);
}

function jalr(regA, regB) {
    return (0b111 << 13) | (regA << 10) | (regB << 7);
}
function hlt() {
    return jalr(0, 0) | 1;
}

let fibbonacci = [
    // init
    lw(1, 0, 0),
    addi(1, 1, -1),
    addi(2, 0, 1),
    add(3, 0, 0),

    // loop
    add(4, 2, 0),
    add(2, 2, 3),
    add(3, 4, 0),
    addi(1, 1, -1),
    beq(0, 1, 2),
    beq(0, 0, -2*6),
    
    // end
    add(1, 3, 0),
    sw(1, 0, 0),
    hlt(),
    beq(0, 0, -2*2),
];

for (let i = 0; i < fibbonacci.length; i++) {
    ram[i] = fibbonacci[i];
}

function update_ios() {
    let temp = read_p;
    console.log("asd");
    document.getElementById("inputs").innerHTML = ""

    while (has_input()) {
        document.getElementById("inputs").innerHTML += `<li>${read_buf()}</li>`
    }
    read_p = temp;

    document.getElementById("outputs").innerHTML = ""
    for (let i = 0; i < outputs.length; i++) {
        document.getElementById("outputs").innerHTML += `<li>${outputs[i]}</li>`
    }
}

function update_values() {
    let outhtml = "";
    outhtml += "<tr>"
    for (let i = 0; i < 8; i++) {
        outhtml += `<td>R${i}</td>`
    }
    outhtml += `<td>PC</td>`;

    outhtml += "</tr>";
    outhtml += "<tr>";
    for (let i = 0; i < 8; i++) {
        let val = registers[i];
        if (val > 1024 * 32) {
            val -= 1024 * 32;
        }
        outhtml += `<td>${registers[i]}</td>`;
    }
    outhtml += `<td>${pc}</td>`;

    outhtml += "</tr>";

    document.getElementById("registers").innerHTML = outhtml;
    show_instr();
}

function tick_once() {
    if (!needs_input_to_continue()) {
        tick();
    } 
    if (needs_input_to_continue()) {
        alert("needs input");
    }
    update_values();
}

function dissasemble_instr(instr) {
    let instr_out = `${instr.instr} R${instr.reg_a}`;
    if (instr.reg_b !== undefined) {
        instr_out += `, R${instr.reg_b}`;
    }
    if (instr.reg_c !== undefined) {
        instr_out += `, R${instr.reg_c}`;
    }
    if (instr.imm !== undefined) {
        instr_out += `, ${instr.imm}`;
    }
    if (instr.s_imm !== undefined) {
        if (instr.s_imm >= 1024 * 32) {
            instr.s_imm -= 1024 * 64;
        }
        instr_out += `, ${instr.s_imm}`;
    }
    return instr_out;
}

function show_instr() {
    let curr_instr = pc / 2;

    let minInstr = 0
    let maxInstr = curr_instr + 10;

    let outhtml = "";

    for (let i = minInstr; i <= maxInstr; i++) {
        let instr = dissasemble_instr(decode_instr(fibbonacci[i]));
        if (i == curr_instr) {
            outhtml += `<li><b>${(i*2).toString(16)}: ${instr}</b></li>`
        } else {
            outhtml += `<li>${(i*2).toString(16)}: ${instr}</li>`
        }
    }

    document.getElementById("instrs").innerHTML = outhtml;
}

function run_until_hlt() {
    halting = false;
    while (!(halting || needs_input_to_continue())) {
        tick();
    }
    if (needs_input_to_continue()) {
        alert("needs input");
    } else {
        alert("halted");
    }
    update_values();
}

function add_input() {
    let i_val = document.getElementById("input_val").value;
    console.log(i_val)
    write_buff(parseInt(i_val) & 0xFFFF);
    update_ios();
}

document.onload += () => {
    update_values();
};

