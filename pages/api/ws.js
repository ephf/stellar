export function WebSocket(socket) {
  socket.on("data", (data) => {
    socket.write("echo: " + data.toString());
  });
}
