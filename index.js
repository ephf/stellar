import listen from "stellar";

listen({
  callback() {
    console.log("listening");
  },
  live: true,
});
