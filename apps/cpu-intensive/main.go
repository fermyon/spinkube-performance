package main

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	spinhttp "github.com/fermyon/spin/sdk/go/v2/http"
)

func init() {
	spinhttp.Handle(func(w http.ResponseWriter, r *http.Request) {
		// Default number to calculate
		x := 42

		// Use number if provided via the request path eg '/42'
		if pathInfos := strings.Split(r.Header.Get("spin-path-info"), "/"); len(pathInfos) == 2 {
			if number, err := strconv.Atoi(pathInfos[1]); err == nil {
				x = number
			}
		}

		fmt.Printf("Calculating fib(%d)\n", x)
		fmt.Fprintf(w, "fib(%d) = %d\n", x, fib(x))
	})
}

func fib(n int) int {
	if n < 2 {
		return n
	}
	return fib(n-2) + fib(n-1)
}

func main() {}
