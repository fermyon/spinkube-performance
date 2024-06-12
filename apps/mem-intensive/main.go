package main

import (
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"

	spinhttp "github.com/fermyon/spin/sdk/go/v2/http"
)

func init() {
	spinhttp.Handle(func(w http.ResponseWriter, r *http.Request) {
		// The baconipsum api maxes out at 100 paras, so potentially make repeated requests
		para_max := 100
		// Default number of paragraphs to fetch
		paras := 1000

		// Use number if provided via the request path eg '/42'
		if pathInfos := strings.Split(r.Header.Get("spin-path-info"), "/"); len(pathInfos) == 2 {
			if number, err := strconv.Atoi(pathInfos[1]); err == nil {
				paras = number
			}
		}

		url := fmt.Sprintf("https://baconipsum.com/api/?type=all-meat&paras=%d&start-with-lorem=1&format=text", paras)
		repeats := 1
		if paras > para_max {
			repeats = int(math.Ceil(float64(paras / para_max)))
			url = fmt.Sprintf("https://baconipsum.com/api/?type=all-meat&paras=%d&start-with-lorem=1&format=text", para_max)
		}

		fmt.Printf("Calculating the number of instances of the word 'bacon' within %d paragraphs of baconipsum...\n", paras)

		text := ""
		for i := 0; i < repeats; i++ {
			resp, err := spinhttp.Get(url)
			if err != nil {
				fmt.Printf("Error encountered attempting to make a GET request to url '%s': %s\n", url, err)
				os.Exit(1)
			}

			body, err := io.ReadAll(resp.Body)
			defer resp.Body.Close()
			if err != nil {
				fmt.Println("Error encountered attempting to read response body: ", err)
				os.Exit(1)
			}
			text += string(body)
		}

		fmt.Fprintf(w, "paragraph count = %d\nbacon count = %d\n", paras, bacon_count(text))
	})
}

func bacon_count(text string) int {
	count := 0
	words := strings.Fields(text)

	for _, word := range words {
		if word == "bacon" {
			count++
		}
	}

	return count
}

func main() {}
