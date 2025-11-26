import { Button } from "./components/Button/Button"
import { Wait } from "./components/Wait/Wait"
import { Box } from "./components/Box/Box"
import { useState } from "react"

export const App = () => {

  const getName = () => {
    fetch("http://127.0.0.1:8000/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Custom-Header": "PracticeHeader"
      },
      body: JSON.stringify({
        message: "Hello from React",
        user: "Mohamed",
        practice: true
      })
    })
      .then(response => response.json())
      .then(data => {
        console.log("Server response:", data)
      })
      .catch(error => {
        console.error("Error:", error)
      });
  };

  return (
    <div>
      Main App
      <Box/>
      <Wait />
      <br />
      <Button onClick={getName} />
    </div>
  );
};
