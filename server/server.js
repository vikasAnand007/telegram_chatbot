import { Telegraf } from "telegraf";
import connectDB from "./src/config/db.js";
import User from "./src/model/user.js";
import { message } from "telegraf/filters";
import Event from "./src/model/event.js";
import OpenAI from "openai";

try {
  await connectDB();
} catch (err) {
  console.log("err", err);
  process.kill(process.pid, "SIGTERM");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

const bot = new Telegraf(process.env.TELEGRAM_BOT_KEY);
bot.start(async (ctx) => {
  const from = ctx.update.message.from;

  try {
    await User.findOneAndUpdate(
      { tgId: from.id },
      {
        firstName: from.first_name,
        lastName: from.last_name,
        isBot: from.is_bot,
        username: from.username,
      },
      { upsert: true, new: true }
    );
    await ctx.reply(
      `Hay ${from.first_name}, Welcome. I will be writing highly engaging social media posts for you. Just keep feeding me the events throughout the day. Let's shine on social media.`
    );
  } catch (err) {
    console.log("err", err);
    await ctx.reply("Facing difficulties!");
  }
});
bot.command("generate", async (ctx) => {
  const from = ctx.update.message.from;

  const { message_id: waitingMsgId } = await ctx.replyWithSticker(
    "CAACAgIAAxkBAANCZkjERgPvRi2DP3AHpvjEAoDwBAoAAhgAA8A2TxPW-ie_nGoY-DUE"
  );

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  try {
    const events = await Event.find({
      tgId: from.id,
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (events.length === 0) {
      await ctx.deleteMessage(waitingMsgId);
      await ctx.reply("No events for the day");
      return;
    }

    const chatCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Act as a senior copywriter, you write highly engaging posts for linkedin, facebook and twitter using provided thoughts/events throughout the day.",
        },
        {
          role: "user",
          content: `Write like a human for humans. Craft three engaging social media posts tailored for LinkedIn, Facebook and Twitter. Use simple language. Use given time labels just to understand the order of the event, don't mention the time in the post. Each post should creatively highlight the olowing events. Ensure the tone is conversational and impactful. Focus on engaging the respective platform's audience. encouraging interactions, and driving interest in the event:
          ${events.map((event) => event.text).join(", ")}
          `,
        },
      ],
      model: process.env.OPENAI_MODEL,
    });

    if (chatCompletion.choices && chatCompletion.choices.length > 0) {
      await User.findOneAndUpdate(
        { tgId: from.id },
        {
          $inc: {
            promptTokens: chatCompletion.usage.prompt_tokens,
            completionTokens: chatCompletion.usage.completion_tokens,
          },
        }
      );
      await ctx.deleteMessage(waitingMsgId);
      await ctx.reply(chatCompletion.choices[0].message.content);
    } else {
      await ctx.deleteMessage(waitingMsgId);
      throw new Error("openai error");
    }
  } catch (err) {
    console.log("err", err);
    await ctx.deleteMessage(waitingMsgId);
    await ctx.reply("Facing difficulties! please try again later.");
  }
});

// JUST TO GET ID OF STICKER --------------
// bot.on(message("sticker"), async (ctx) => {
//   const from = ctx.update.message.from;
//   const message = ctx.update.message;
//   console.log("sticker", message);
// });

bot.on(message("text"), async (ctx) => {
  const from = ctx.update.message.from;
  const message = ctx.update.message.text;
  try {
    const newEvent = new Event({
      text: message,
      tgId: from.id,
    });
    await newEvent.save();
    await ctx.reply(
      "Noted, keep texting me your thoughts. To generate the post send me command: /generate"
    );
  } catch (err) {
    console.log("err", err);
    await ctx.reply("Facing difficulties! please try again later.");
  }
});

bot.launch();
// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
