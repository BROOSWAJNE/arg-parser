// TODO: clean up
// TODO: tests

module.exports = function createParser(spec = {}, {
    warnIfUnknown = true,
    errorIfUnknown = false,
    defaultPositions = Object.keys(spec),
    helpArgument = ['-h', '--help'],
} = {}) {
    if (typeof helpArgument === 'string') helpArgument = [helpArgument];

    const unknownArgument = (argName, argType = 'argument') => {
        const message = `Unrecognised ${argType}: ${argName}`;
        if (warnIfUnknown) process.stderr.write(message + '\n');
        if (errorIfUnknown) throw new Error(message);
    };

    for (const argName in spec) {
        if (!/^[\w-]+$/.test(argName)) throw new Error(`Invalid argument name: ${argName}`);
    }

    return function parse(args) {
        if (args === process.argv) args = args.slice(2); // ignore execPath and file being executed

        if (args.some(arg => helpArgument.includes(arg))) {
            const descriptions = Object.keys(spec).map(arg => {
                const {
                    type = String,
                    flag = arg[0],
                    defaultValue = (type === Boolean ? false : undefined),
                    description,
                } = spec[arg];
                const name = `\x1b[1m--${arg}${type === Boolean ? ` (-${flag})` : ''}:\x1b[0m \x1b[2m(${type.name})\x1b[0m\n`;
                const desc = [];
                if (description) desc.push(description);
                if (defaultValue !== undefined) desc.push(`\x1b[2mDefaults to: ${defaultValue}\x1b[0m`);
                return name + desc.map(line => '  ' + line).join('\n');
            });
            process.stdout.write('Commands available:\n\n' + descriptions.join('\n\n') + '\n');
            process.exit(0);
        }

        const parsed = Object.keys(spec).reduce((parsed, argName) => {
            const argSpec = spec[argName];
            if ('defaultValue' in argSpec) parsed[argName] = argSpec['defaultValue'];
            return parsed;
        }, {});

        const argNameForFlag = {};
        const specFlags = Object.keys(spec).reduce((specFlags, argName) => {
            const {
                type,
                flag = argName[0],
            } = spec[argName];
            if (type !== Boolean) return specFlags;
            if (flag in specFlags) throw new Error(`Repeated flag name: ${flag} (argument ${argName})`);
            specFlags[flag] = spec[argName];
            argNameForFlag[flag] = argName;
            return specFlags;
        }, {});
        const parseFlags = (flags) => flags.forEach(flag => {
            if (!(flag in specFlags)) return void unknownArgument(flag, 'flag');
            const argName = argNameForFlag[flag];
            const { defaultValue = false } = specFlags[flag];
            parsed[argName] = !defaultValue;
        });

        const parseNamedArg = (name, value) => {
            if (!(name in spec)) return void unknownArgument(name);
            const {
                type = String,
                validate = () => true,
            } = spec[name];
            if (!validate(value)) return; // ignore. throw an error from the validator if wanted.

            if (type === String) parsed[name] = value;
            else if (type === Boolean) parsed[name] = value.trim() === 'true';
            else if (type === Number) parsed[name] = Number(value);
            else if (type === RegExp) parsed[name] = new RegExp(value);
            else if (type === Array) {
                if (name in parsed) parsed[name].push(value);
                else parsed[name] = [value];
            }
        };

        let unnamed = true;
        for (let argIdx = 0; argIdx < args.length; argIdx++) {
            const arg = args[argIdx];
            const isFlags = arg.match(/^-(\w+)/);
            const hasName = arg.match(/^--([\w-]+)=/);
            unnamed = unnamed && !isFlags && !hasName;

            if (isFlags) parseFlags(isFlags[1].split(''));
            else if (hasName) parseNamedArg(hasName[1], arg.substring(hasName[0].length));
            else if (argIdx < defaultPositions.length) {
                if (unnamed) parseNamedArg(defaultPositions[argIdx], arg);
                else throw new Error(`Unnamed argument "${arg}" passed after named arguments`);
            }
            // otherwise ignore
        }

        for (const argName in spec) {
            const { required = false } = spec[argName];
            if (!required) continue;
            if (!(argName in parsed)) throw new Error(`Missing required argument "${argName}"`);
        }

        return parsed;
    };
};
