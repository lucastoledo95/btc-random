import CoinKey from 'coinkey';
import walletsArray from './wallets.js';
import chalk from 'chalk';
import crypto from 'crypto';
import bs58 from 'bs58';
import fs from 'fs';
import { promises as fsPromises } from 'fs';


const walletsSet = new Set(walletsArray);

async function encontrarBitcoins(key, min, max, shouldStop, rand = 0) {
    let segundos = 0;
    let pkey = 0n;
    let chavesArray10s = new Set();

    const um = rand === 0 ? 0n : BigInt(rand);
    const startTime = Date.now();
    let keysInLastFull = 0n;
    const zeroes = Array.from({ length: 65 }, (_, i) => '0'.repeat(64 - i));

    console.log('Resumo: ');
    console.log('Buscando Bitcoins...');

    key = getRandomBigInt(min, max);
    let running = true;


    async function achou(pkey) {
        const publicKey = generatePublic(pkey);

        if (walletsSet.has(publicKey)) {
            const tempo = (Date.now() - startTime) / 1000;
            const dataFormatada = new Date().toLocaleDateString();
            console.clear();
            console.log('Velocidade:', arrerondar(Number(key - min) / tempo), ' chaves por segundo - quanto menor melhor');
            console.log('Chaves buscadas no total:', keysInLastFull.toString());
            console.log('Tempo:', tempo, 'segundos');
            console.log('Private key:', chalk.green(pkey));
            console.log('WIF:', chalk.green(generateWIF(pkey)));

            const filePathKeys = 'keys.txt';
            const lineToAppend = `Private key: ${pkey}, WIF: ${generateWIF(pkey)} , Data: ${dataFormatada}\n`;

            try {
                await fsPromises.appendFile(filePathKeys, lineToAppend, 'utf8');
                console.log(`Private key e WIF salvos no arquivo: ${filePathKeys}`);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log(`Arquivo ${filePathKeys} não encontrado. Criando um novo arquivo...`);
                    const initialContent = `Chaves encontradas:\n`;
                    await fsPromises.writeFile(filePathKeys, initialContent, 'utf8');
                    await fsPromises.appendFile(filePathKeys, lineToAppend, 'utf8');
                    console.log(`Private key e WIF salvos no arquivo: ${filePathKeys}`);
                } else {
                    console.error(`Erro ao acessar o arquivo ${filePathKeys}:`, error);
                }
            }

            running = false;
            return(0);
        }
    }

    let pkeyBackup = '';

    const executeLoop = async () => {
        while (running && !shouldStop()) {
            key += um;
            pkey = key.toString(16);
            pkey = `${zeroes[pkey.length]}${pkey}`;

            await achou(pkey);
            const base58Key = bs58.encode(Buffer.from(pkey, 'hex'));

            if (pkeyBackup === pkey || chavesArray10s.has(base58Key)) {
                await achou(pkey);
                key = getRandomBigInt(min, max);
                continue;
            }

            chavesArray10s.add(base58Key);
            keysInLastFull += 1n;

            if (Date.now() - startTime > segundos) {
                segundos += 1000;
                console.log(segundos / 1000);
                if (segundos % 10000 === 0) {
                    const tempo = (Date.now() - startTime) / 1000;
                    console.clear();
                    console.log('Resumo: ');
                    console.log('Total de chaves buscadas:', arrerondar(keysInLastFull.toString()));
                    console.log('Tempo em hash total:', arrerondar(keysInLastFull.toString() / segundos), '- total de chaves buscadas/' + (segundos/1000)+' segundos');
                    console.log('Chaves buscadas em 10 segundos:', chavesArray10s.size, '- quanto maior melhor');
                    console.log('Ultima chave tentada:', pkey);

                    const filePath = 'Ultima_chave.txt';
                    const content = `Última chave tentada: ${pkey}`;

                    try {
                        await fsPromises.writeFile(filePath, content, 'utf8');
                    } catch (error) {
                        if (error.code === 'ENOENT') {
                            console.log(`Arquivo ${filePath} não encontrado. Criando um novo arquivo...`);
                            await fsPromises.writeFile(filePath, content, 'utf8');
                        } else {
                            console.error(`Erro ao escrever no arquivo ${filePath}:`, error);
                        }
                    }

                    
                    chavesArray10s.clear();
                    key = getRandomBigInt(min, max);

                    if (key >= max) {
                        key = min;
                    }
                }

            }

            pkeyBackup = pkey;
            await new Promise(resolve => setImmediate(resolve));
        }
        
    };

    await executeLoop();
}

function generatePublic(privateKey) {
    const key = new CoinKey(Buffer.from(privateKey, 'hex'));
    key.compressed = true;
    return key.publicAddress;
}

function generateWIF(privateKey) {
    const key = new CoinKey(Buffer.from(privateKey, 'hex'));
    return key.privateWif;
}

function getRandomBigInt(min, max) {
    const range = max - min;
    const randomBigIntInRange = BigInt(`0x${crypto.randomBytes(32).toString('hex')}`) % range;
    return min + randomBigIntInRange;
}

function arrerondar(numero, casasDecimais = 2) {
    const [integerPart, fractionalPart = ''] = numero.toString().split('.');
    const adjustedFractional = fractionalPart.padEnd(casasDecimais, '0').slice(0, casasDecimais);
    const roundedNumber = integerPart + '.' + adjustedFractional;
    return parseFloat(roundedNumber);
}

export default encontrarBitcoins;
