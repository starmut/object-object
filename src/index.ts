import AeroClient, { Arguments } from "@aeroware/aeroclient";
import { config as dotenv } from "dotenv";
import Fuse from "fuse.js";
import leven from "leven";
import users from "./models/user";

dotenv();

(async () => {
    const client = await AeroClient.create();

    client.commands.delete("setprefix");
    client.commands.delete("setlocale");
    client.commands.get("help")!.category = "information";

    client
        .use(({ message, command }, next, stop) => {
            if (
                message.content.startsWith(client.clientOptions.prefix!) &&
                !command
            ) {
                const fuse = new Fuse(
                    [
                        ...[
                            ...client.commands.values(),
                        ].flatMap(({ name, aliases }) => [
                            name,
                            ...(aliases ?? []),
                        ]),
                    ],
                    {
                        isCaseSensitive: false,
                    }
                );

                const [cmd, ...args] = message.content
                    .slice(client.clientOptions.prefix!.length)
                    .split(/\s+/);

                if (!/^[a-zA-Z0-9_-]+$/.test(cmd)) return next();

                const [result] = fuse.search(
                    message.content
                        .slice(client.clientOptions.prefix!.length)
                        .split(/\s+/)[0]
                );

                const dist = leven(result.item, cmd);

                if (dist < Math.ceil((result.item.length / 3) * 2)) {
                    message.channel.send(`Did you mean \`${result.item}\`?`);

                    const collector = message.channel.createMessageCollector(
                        (msg) => msg.author.id === message.author.id,
                        {
                            max: 1,
                            time: 30000,
                        }
                    );

                    collector.on("collect", async (msg) => {
                        if (msg.content.trim().toLowerCase() === "fuck") {
                            const command =
                                client.commands.get(result.item) ??
                                client.commands.find(
                                    ({ aliases }) =>
                                        !!aliases?.includes(result.item)
                                )!;

                            command.callback({
                                message,
                                args,
                                parsed:
                                    (command.metasyntax &&
                                        (await command.metasyntax.parse(
                                            message,
                                            args
                                        ))) ||
                                    [],
                                client,
                                text: message.content,
                                locale:
                                    (await client.localeStore.get(
                                        message.author.id
                                    )) || "en",
                            });
                        }
                    });

                    return stop();
                }
            }

            return next();
        })
        .use(async ({ message }) => {
            if (!(await users.findById(message.author.id)))
                await users.create({
                    _id: message.author.id,
                });
        });

    Arguments.use(client);
})();
