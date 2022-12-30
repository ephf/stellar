export default function () {
  return () => {
    const ws = new WebSocket("ws://localhost/api/ws");
    ws.onopen = () => {
      ws.onmessage = ({ data }) => {
        console.log(data);
      };
    };

    console.log("ready!");

    return (
      <input
        placeholder="Message"
        onchange={function () {
          ws.send(this.value);
          this.value = "";
        }}
      />
    );
  };
}
