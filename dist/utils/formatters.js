"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCNPJ = exports.maskCNPJ = exports.safeParseFloat = exports.parseCurrency = exports.maskCurrency = exports.formatBytes = exports.formatPercentage = exports.formatCurrency = void 0;
const formatCurrency = (value) => {
    const safeValue = value ?? 0;
    return (safeValue || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};
exports.formatCurrency = formatCurrency;
const formatPercentage = (value) => {
    const safeValue = value ?? 0;
    return `${safeValue.toFixed(2)}%`;
};
exports.formatPercentage = formatPercentage;
const formatBytes = (bytes) => {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
exports.formatBytes = formatBytes;
const maskCurrency = (value) => {
    if (value === undefined || value === null)
        return "";
    const onlyDigits = String(value).replace(/\D/g, "");
    if (onlyDigits === "")
        return "";
    const numberValue = Number(onlyDigits) / 100;
    return (numberValue || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};
exports.maskCurrency = maskCurrency;
const parseCurrency = (value) => {
    if (!value)
        return 0;
    const onlyDigits = String(value).replace(/\D/g, "");
    return Number(onlyDigits) / 100;
};
exports.parseCurrency = parseCurrency;
const safeParseFloat = (value) => {
    let val = parseFloat(value.replace(',', '.'));
    if (isNaN(val))
        return 0;
    if (val < 0)
        return 0;
    if (val > 100)
        return 100;
    return Math.round(val * 10000) / 10000;
};
exports.safeParseFloat = safeParseFloat;
const maskCNPJ = (value) => {
    return value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .substring(0, 18);
};
exports.maskCNPJ = maskCNPJ;
const validateCNPJ = (cnpj) => {
    const clean = cnpj.replace(/[^\d]+/g, '');
    if (clean === '')
        return false;
    if (clean.length !== 14)
        return false;
    if (/^(\d)\1+$/.test(clean))
        return false;
    let size = clean.length - 2;
    let numbers = clean.substring(0, size);
    const digits = clean.substring(size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--;
        if (pos < 2)
            pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0)))
        return false;
    size = size + 1;
    numbers = clean.substring(0, size);
    sum = 0;
    pos = size - 7;
    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--;
        if (pos < 2)
            pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1)))
        return false;
    return true;
};
exports.validateCNPJ = validateCNPJ;
